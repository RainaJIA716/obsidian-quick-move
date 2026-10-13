import {
	AbstractInputSuggest,
	App,
	FuzzySuggestModal,
	MarkdownView,
	Menu,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
	TFolder,
	View,
	normalizePath,
} from "obsidian";

interface FolderEntry {
	path: string;
	alias: string;
}

interface QuickMoveSettings {
	folders: FolderEntry[];
}

const DEFAULT_SETTINGS: QuickMoveSettings = { folders: [] };

const ACTION_CLASS = "quick-move-action";

const STRINGS = {
	en: {
		moveTo: "Move to…",
		openMenuCommand: "Open move menu",
		addFoldersHint: "Add folders in settings",
		missing: (label: string) => `${label} (missing)`,
		otherFolder: "Other folder…",
		pickerPlaceholder: "Type a folder name to move this note to…",
		root: "/ (vault root)",
		timeout: "the note did not show up in the target folder within 5 seconds",
		failed: (msg: string) => `Move failed: ${msg}`,
		moved: (label: string) => `Moved to "${label}"`,
		renamed: (name: string) => `A note with the same name was already there, so this one is now ${name}`,
		settingsIntro:
			"Folders listed in the \"Move to…\" menu at the top right of each note, in this order. Leave the alias empty to show the full path.",
		pathPlaceholder: "Folder path",
		aliasPlaceholder: "Alias (optional)",
		noSuchFolder: "No such folder in this vault",
		up: "Move up",
		down: "Move down",
		remove: "Remove",
		addFolder: "+ Add folder",
	},
	zh: {
		moveTo: "移动到…",
		openMenuCommand: "打开移动菜单",
		addFoldersHint: "去设置里添加文件夹",
		missing: (label: string) => `${label}（不存在）`,
		otherFolder: "其他文件夹…",
		pickerPlaceholder: "输入文件夹名称，移动到…",
		root: "/（根目录）",
		timeout: "移动后 5 秒内没在目标位置找到笔记",
		failed: (msg: string) => `移动失败：${msg}`,
		moved: (label: string) => `已移动到「${label}」`,
		renamed: (name: string) => `同名笔记已存在，改名为 ${name}`,
		settingsIntro: "笔记右上角「移动到…」菜单里列出的文件夹，按这里的顺序显示。别名不填就显示完整路径。",
		pathPlaceholder: "文件夹路径",
		aliasPlaceholder: "别名（可不填）",
		noSuchFolder: "库里没有这个文件夹",
		up: "上移",
		down: "下移",
		remove: "删除",
		addFolder: "+ 添加文件夹",
	},
};

// 跟随 Obsidian 的界面语言（getLanguage() 要 1.8.7，这里沿用 localStorage 的写法，minAppVersion 不用升）
const t = (window.localStorage.getItem("language") || "en").startsWith("zh") ? STRINGS.zh : STRINGS.en;

/** "" / "/" 都表示库的根目录 */
function cleanFolderPath(path: string): string {
	const p = normalizePath(path.trim());
	return p === "" || p === "." ? "/" : p;
}

function parentPathOf(file: TFile): string {
	return file.parent ? cleanFolderPath(file.parent.path) : "/";
}

function joinPath(folder: string, name: string): string {
	return folder === "/" ? name : normalizePath(`${folder}/${name}`);
}

export default class QuickMovePlugin extends Plugin {
	settings: QuickMoveSettings = DEFAULT_SETTINGS;
	private buttons = new WeakMap<View, HTMLElement>();

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new QuickMoveSettingTab(this.app, this));

		this.app.workspace.onLayoutReady(() => this.addButtons());
		this.registerEvent(this.app.workspace.on("layout-change", () => this.addButtons()));

		// 在文件列表里给文件夹改名时，快捷列表跟着改
		this.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => {
				if (file instanceof TFolder) this.onFolderRenamed(oldPath, file.path);
			}),
		);

		this.addCommand({
			id: "open-move-menu",
			name: t.openMenuCommand,
			icon: "folder-input",
			checkCallback: (checking) => {
				const view = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (!view?.file) return false;
				if (!checking) this.showMenu(view);
				return true;
			},
		});
	}

	onunload() {
		// 注入到原生顶栏的按钮不会随插件卸载自动消失，要自己收回（按 leaf 找，弹出窗口里的也能收到）
		for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
			leaf.view.containerEl.querySelectorAll(`.${ACTION_CLASS}`).forEach((el) => el.remove());
		}
	}

	async loadSettings() {
		const data = (await this.loadData()) as Partial<QuickMoveSettings> | null;
		this.settings = { folders: Array.isArray(data?.folders) ? data!.folders : [] };
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private addButtons() {
		for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
			const view = leaf.view;
			if (!(view instanceof MarkdownView) || this.buttons.has(view)) continue;
			const btn = view.addAction("folder-input", t.moveTo, () => this.showMenu(view));
			btn.addClass(ACTION_CLASS);
			this.buttons.set(view, btn);
		}
	}

	/** 按按钮的位置弹出（键盘、命令触发时没有鼠标坐标）；手机上 Menu 自己会变成底部弹出 */
	private showMenu(view: MarkdownView) {
		const menu = this.buildMenu(view);
		const btn = this.buttons.get(view);
		if (btn && btn.isShown()) {
			const r = btn.getBoundingClientRect();
			menu.showAtPosition({ x: r.right, y: r.bottom, width: r.width, overlap: true, left: true });
		} else {
			menu.showAtPosition({ x: window.innerWidth / 2, y: window.innerHeight / 3 });
		}
	}

	private buildMenu(view: MarkdownView): Menu {
		const menu = new Menu();
		const file = view.file;
		if (!file) return menu;
		const current = parentPathOf(file);

		if (this.settings.folders.length === 0) {
			menu.addItem((item) =>
				item
					.setTitle(t.addFoldersHint)
					.setIcon("settings")
					.onClick(() => this.openSettings()),
			);
		}

		for (const entry of this.settings.folders) {
			const path = cleanFolderPath(entry.path);
			const exists = path === "/" || this.app.vault.getAbstractFileByPath(path) instanceof TFolder;
			const label = entry.alias.trim() || path;
			menu.addItem((item) => {
				item.setTitle(exists ? label : t.missing(label)).setIcon("folder");
				if (path === current) {
					item.setChecked(true).setDisabled(true);
				} else if (!exists) {
					item.setDisabled(true);
				} else {
					item.onClick(() => this.moveTo(file, path, label));
				}
			});
		}

		// 不用原生「移动到…」：它属于核心「文件列表」插件，关掉文件列表（比如改用 Notebook Navigator）后命令就没了
		menu.addSeparator();
		menu.addItem((item) =>
			item
				.setTitle(t.otherFolder)
				.setIcon("folder-search")
				.onClick(() =>
					new FolderPickerModal(this.app, current, (folder) =>
						this.moveTo(file, cleanFolderPath(folder.path), cleanFolderPath(folder.path)),
					).open(),
				),
		);
		return menu;
	}

	private openSettings() {
		const setting = (this.app as any).setting;
		setting?.open();
		setting?.openTabById(this.manifest.id);
	}

	/** 目标被同名文件占了就换成 名字-1、名字-2…，不跳过 */
	private availablePath(folder: string, file: TFile): string {
		const vault = this.app.vault;
		let target = joinPath(folder, file.name);
		for (let i = 1; vault.getAbstractFileByPath(target); i++) {
			const name = file.extension ? `${file.basename}-${i}.${file.extension}` : `${file.basename}-${i}`;
			target = joinPath(folder, name);
		}
		return target;
	}

	async moveTo(file: TFile, folder: string, label: string) {
		const target = this.availablePath(folder, file);
		const newName = target.split("/").pop();
		const renamed = newName !== file.name;
		try {
			await this.app.fileManager.renameFile(file, target);
			// 问宿主索引确认到位，不读 file.path
			const deadline = Date.now() + 5000;
			while (this.app.vault.getAbstractFileByPath(target) !== file) {
				if (Date.now() >= deadline) throw new Error(t.timeout);
				await new Promise((r) => setTimeout(r, 25));
			}
		} catch (e) {
			console.error("[quick-move]", e);
			new Notice(t.failed(e instanceof Error ? e.message : String(e)));
			return;
		}
		new Notice(renamed ? `${t.moved(label)}\n${t.renamed(newName ?? "")}` : t.moved(label));
	}

	private async onFolderRenamed(oldPath: string, newPath: string) {
		let changed = false;
		for (const entry of this.settings.folders) {
			const p = cleanFolderPath(entry.path);
			if (p === oldPath) {
				entry.path = newPath;
				changed = true;
			} else if (p.startsWith(oldPath + "/")) {
				entry.path = newPath + p.slice(oldPath.length);
				changed = true;
			}
		}
		if (changed) await this.saveSettings();
	}
}

class FolderPickerModal extends FuzzySuggestModal<TFolder> {
	constructor(
		app: App,
		private current: string,
		private onChoose: (folder: TFolder) => void,
	) {
		super(app);
		this.setPlaceholder(t.pickerPlaceholder);
	}

	getItems(): TFolder[] {
		return this.app.vault
			.getAllLoadedFiles()
			.filter((f): f is TFolder => f instanceof TFolder && cleanFolderPath(f.path) !== this.current);
	}

	getItemText(folder: TFolder): string {
		return folder.isRoot() ? t.root : folder.path;
	}

	onChooseItem(folder: TFolder) {
		this.onChoose(folder);
	}
}

class FolderSuggest extends AbstractInputSuggest<TFolder> {
	constructor(app: App, private inputEl: HTMLInputElement) {
		super(app, inputEl);
	}

	getSuggestions(query: string): TFolder[] {
		const q = query.toLowerCase();
		return this.app.vault
			.getAllLoadedFiles()
			.filter((f): f is TFolder => f instanceof TFolder && f.path.toLowerCase().includes(q))
			.sort((a, b) => a.path.localeCompare(b.path))
			.slice(0, 50);
	}

	renderSuggestion(folder: TFolder, el: HTMLElement) {
		el.setText(folder.isRoot() ? t.root : folder.path);
	}

	selectSuggestion(folder: TFolder) {
		this.setValue(folder.path);
		this.inputEl.dispatchEvent(new Event("input"));
		this.close();
	}
}

class QuickMoveSettingTab extends PluginSettingTab {
	constructor(app: App, private plugin: QuickMovePlugin) {
		super(app, plugin);
	}

	display() {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl("p", {
			text: t.settingsIntro,
			cls: "setting-item-description",
		});

		const folders = this.plugin.settings.folders;
		folders.forEach((entry, i) => {
			const setting = new Setting(containerEl).setClass("quick-move-row");
			setting.infoEl.remove();

			setting.addText((text) => {
				text.setPlaceholder(t.pathPlaceholder).setValue(entry.path);
				text.inputEl.addClass("quick-move-path");
				new FolderSuggest(this.app, text.inputEl);
				const validate = () => {
					const p = cleanFolderPath(text.getValue());
					const ok =
						text.getValue().trim() !== "" &&
						(p === "/" || this.app.vault.getAbstractFileByPath(p) instanceof TFolder);
					text.inputEl.toggleClass("quick-move-invalid", !ok);
					text.inputEl.title = ok ? "" : t.noSuchFolder;
				};
				validate();
				text.onChange(async (value) => {
					entry.path = value.trim();
					validate();
					await this.plugin.saveSettings();
				});
			});

			setting.addText((text) => {
				text.setPlaceholder(t.aliasPlaceholder).setValue(entry.alias);
				text.inputEl.addClass("quick-move-alias");
				text.onChange(async (value) => {
					entry.alias = value;
					await this.plugin.saveSettings();
				});
			});

			setting.addExtraButton((b) =>
				b
					.setIcon("arrow-up")
					.setTooltip(t.up)
					.setDisabled(i === 0)
					.onClick(() => this.swap(i, i - 1)),
			);
			setting.addExtraButton((b) =>
				b
					.setIcon("arrow-down")
					.setTooltip(t.down)
					.setDisabled(i === folders.length - 1)
					.onClick(() => this.swap(i, i + 1)),
			);
			setting.addExtraButton((b) =>
				b
					.setIcon("x")
					.setTooltip(t.remove)
					.onClick(async () => {
						folders.splice(i, 1);
						await this.plugin.saveSettings();
						this.display();
					}),
			);
		});

		new Setting(containerEl).addButton((b) =>
			b.setButtonText(t.addFolder).onClick(async () => {
				folders.push({ path: "", alias: "" });
				await this.plugin.saveSettings();
				this.display();
				const inputs = containerEl.querySelectorAll<HTMLInputElement>(".quick-move-path");
				inputs[inputs.length - 1]?.focus();
			}),
		);
	}

	private async swap(a: number, b: number) {
		const folders = this.plugin.settings.folders;
		if (b < 0 || b >= folders.length) return;
		[folders[a], folders[b]] = [folders[b], folders[a]];
		await this.plugin.saveSettings();
		this.display();
	}
}
