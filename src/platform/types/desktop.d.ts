// 来自 claude.ai Artifact 运行时 0.2.99 的类型定义（artifact-capabilities 技能附带），原样保留。升级运行时版本时整体替换。
/**
 * The `desktop` capability - lets the person install a published artifact
 * as a desktop app, from the Claude desktop app: "Install as app" in the
 * artifact's menu makes an app with its own window and icon. In such a
 * window, and only there, `await claude.use("desktop")` resolves the API: the
 * person's files, child processes and a terminal, a floating or transparent
 * window, global shortcuts, notifications, context menus, a menu bar item (on
 * Windows an icon in the system tray) and, on macOS, the application menu bar
 * and the Dock tile.
 * Declared as `capabilities: {desktop: {}}`; the permissions the page uses
 * go in a JSON tag in its HTML (see {@link ClaudeDesktop.Manifest}). Outside
 * that window, in a browser, the artifact panel and the mobile apps,
 * `claude.use("desktop")` resolves an object holding only
 * {@link ClaudeDesktop.install}, whatever the artifact declares. A signed-in
 * person from another organization who opens the artifact by its public link
 * or an invitation gets the same result as a member of the artifact's
 * organization, though `"full-access"` is usually refused (see
 * {@link ClaudeDesktop.Permission}).
 * `claude.use("desktop")` resolves `null` for a person who is
 * signed out, for whom desktop apps are off or whose organization may not use
 * them (in the app's own window too), on a page the platform serves top-level
 * (as its own page on the artifact's host), on any other view that does not
 * serve `desktop` (see `claude.use`), and when the capability's code fails to
 * load: so check for a module you need (`desktop?.fs`), not for the object,
 * and reach `install` as `desktop?.install`. When that module is missing,
 * offer the person a button to install the app when `desktop?.install.state()`
 * reads `"available"`, and otherwise one line saying the page works only in
 * its desktop app, which can be installed from the Claude desktop app. When
 * the person asks for a desktop app, a Mac app, a widget that floats on the
 * desktop, or a page that reads or writes their disk without a file picker or
 * runs commands, build an ordinary artifact on this API, publish it as usual
 * and tell them to install it. For a file the person picks, use an
 * `<input type="file">`; for a Claude Code project's files, the `files`
 * capability.
 *
 * The namespace's members are modules, not methods. Every call on them
 * returns a promise, except the two `spawn()` and the event subscriptions on
 * what they return. A failed call rejects with an `Error` whose message
 * usually starts with an errno-style code (see
 * {@link ClaudeDesktop.ErrorCode}). Files, commands, floating windows,
 * shortcuts, notifications and the menu bar item can each be off for this
 * person, off on their system, or refused by them, so catch these and say
 * what the app cannot do rather than failing whole. A call that has to ask
 * the person waits for their answer, and rejects `ENOTSUP` while the window
 * is hidden, which it is while the app installs: make the first call that
 * needs a permission from something the person did (a click), or check
 * `permissions.state()` first, never bare on load. Paths may start with
 * `~/`; a relative path starts at the home folder.
 *
 * Once a page has full access, nothing in Claude's platform asks the person
 * before it deletes a file or runs a command, so this is advice on the page's
 * design, not a rule: when the page itself chooses to delete or replace the
 * person's files, or to run a command that can delete or overwrite their
 * data, have it show that first and wait for one press of a button in the
 * page (`confirm()` opens nothing in an artifact). What the person asked for
 * by name needs no second question: a save, a button that says what it will
 * delete or run, a clean-up they asked to have run on a schedule. To delete
 * their own files prefer `shell.trashItem`, which moves them to the Trash, to
 * `fs.rm`.
 *
 * The app's name is the page's `<title>`, cut to 50 characters; a name that
 * looks like another app's ("Safari", "Claude") gets " (Artifact)" added.
 * Always give the app an icon of its own: draw it on a square canvas (for
 * example 256 px a side; the PNG must stay under 256 KB) and pass
 * `canvas.toDataURL("image/png")` to `desktop.app.dock.setIcon` while the
 * page loads. Claude uses it as drawn and does not round its corners. Without
 * it the app gets at best a stock symbol, or the first letter of its name, on
 * a colored tile.
 *
 * What the web already does is not here, so use the web's own: getUserMedia
 * for the camera and microphone and navigator.geolocation (declare `camera`,
 * `microphone` or `geolocation` as any artifact does: the app's window
 * grants them; location on macOS only, none of them in a transparent window,
 * and a page holding one reloads when its window is shown again after
 * `window.hide()`),
 * `navigator.clipboard.writeText()` after a click and the `paste` event
 * (`navigator.clipboard.readText()` is refused), an ordinary http(s) link
 * the person clicks to open a URL, `document.hasFocus()` and
 * `document.visibilityState`, `window.screen`, Web Audio. Nothing keeps the
 * display awake or says how long the person has been away: wake locks and
 * idle detection are refused.
 *
 * Processes, shortcuts and the menu bar item end when the window closes or
 * the page reloads. On macOS, while the app runs from its tile and has a menu
 * bar item, closing its window only hides it.
 *
 * On Windows `os.platform()` reads `"win32"`: check it before choosing
 * commands or paths. There is no application menu bar and no Dock tile:
 * `Menu.setApplicationMenu` shows nothing and its accelerators do nothing, so
 * put commands in the page or in `Menu.popup`. `app.dock.setIcon` still sets
 * the app's icon, on its shortcuts and its window.
 * `window.hide()` minimizes the window and, if the app has a tray icon, may
 * also take the window off the taskbar. Closing the window ends an app with no
 * tray icon; with a tray icon, closing may end the app or only hide or
 * minimize the window, so count on neither.
 * `exec`, and `childProcess.spawn` with `shell: true`, run in cmd.exe; plain
 * `spawn` refuses a .cmd or .bat program. Any `ChildProcess.kill` signal
 * force-ends the process tree. `window.setOptions` with `frame: false`,
 * `transparent` or `alwaysOnTop`, and `window.setIgnoreMouseEvents(true)`,
 * reject `ENOTSUP` while the app is not installed.
 *
 * ```html
 * <script type="application/json" id="claude-artifacts-manifest">{"permissions": ["full-access"]}</script>
 * <script type="module">
 * const desktop = await claude.use("desktop");
 * if (!desktop?.fs) {
 *   if ((await desktop?.install.state()) === "available") {
 *     const button = document.body.appendChild(document.createElement("button"));
 *     button.textContent = "Install as app";
 *     button.onclick = () => desktop.install.request().catch(console.error);
 *   } else {
 *     document.body.textContent = "This page works only in its desktop app, which can be installed from the Claude desktop app.";
 *   }
 * } else {
 *   desktop.app.dock.setIcon(drawIcon()).catch(console.error); // drawIcon() is yours to write: it draws on a 256 px square canvas and returns canvas.toDataURL("image/png")
 *   await desktop.window
 *     .setOptions({ titleBarStyle: "hiddenInset", dragHeight: 36, vibrancy: "under-window", width: 900, height: 600 })
 *     .catch(console.error);
 *   document.querySelector("#open").onclick = async () => {
 *     const notes = await desktop.fs.readFile("~/notes.md", "utf8").catch((error) => {
 *       if (error.message.startsWith("ENOENT")) return "";
 *       document.body.textContent = `Can't read your notes: ${error.message}`;
 *       return null;
 *     });
 *     if (notes !== null) render(notes);
 *   };
 * }
 * </script>
 * ```
 */
interface ClaudeDesktop {
  /** The one member outside the app's window. */
  install: ClaudeDesktop.Install;
  permissions: ClaudeDesktop.Permissions;
  window: ClaudeDesktop.AppWindow;
  Menu: ClaudeDesktop.Menu;
  app: { dock: ClaudeDesktop.Dock };
  /** Needs `"full-access"`. */
  fs: ClaudeDesktop.Fs;
  /** Needs `"full-access"`. */
  childProcess: ClaudeDesktop.ChildProcesses;
  /** Needs `"full-access"`. */
  pty: ClaudeDesktop.Pty;
  /** `platform()` and `arch()` need nothing; the rest need
   *  `"full-access"`. */
  os: ClaudeDesktop.Os;
  /** Needs `"full-access"`. */
  shell: ClaudeDesktop.Shell;
  /** Needs `"overlay"`. */
  screen: ClaudeDesktop.Screen;
  /** `register` needs `"shortcuts"`. */
  globalShortcut: ClaudeDesktop.GlobalShortcut;
  /** Needs `"notifications"`. */
  notification: ClaudeDesktop.Notifications;
  /** `set` needs `"menu-bar"`. */
  tray: ClaudeDesktop.Tray;
}

declare namespace ClaudeDesktop {
  /**
   * Lets the page draw its own install button. Works where the Claude desktop
   * app's main window offers Install as app for the artifact, such as beside a
   * chat, in the Code tab and on the artifact's full page, and in the app's
   * own window before it is installed. `state()` reads `"unavailable"` in a
   * browser, the mobile apps, a pop-out window and the copy of the page that
   * Claude's preview tools capture, so go by `state()`, not by the place.
   * Installing grants no permission.
   */
  interface Install {
    /** `"available"` (show the button), `"installed"` (this computer has the
     *  app; there is nothing to request) or `"unavailable"` (hide it). */
    state(): Promise<"available" | "installed" | "unavailable">;
    /**
     * Asks Claude to install this artifact. Call it straight from a click
     * or key press in the page: without one it rejects `EPERM`. Claude shows
     * its own dialog with the app's name, and the promise settles once the
     * person answers: `"installed"` (the install is under way and Claude says
     * so itself if it fails, or this computer has the app already, which opens
     * nothing), `"cancelled"` (they said no; don't ask again until they
     * click), `"unavailable"` or `"failed"`. While it installs Claude may
     * close the panel this page is in.
     */
    request(): Promise<"installed" | "cancelled" | "unavailable" | "failed">;
  }

  /**
   * The capability takes no config: declare `capabilities: {desktop: {}}`.
   * The permissions the page uses are declared in the page itself, in one
   * JSON tag the desktop app reads before any call:
   * `<script type="application/json" id="claude-artifacts-manifest">{"permissions": ["overlay", "shortcuts"]}</script>`.
   * One that is not listed there is refused without asking the person (its
   * state reads `"unavailable"`), so list exactly what the page calls. A
   * page with no tag still installs and gets every call that needs none.
   */
  interface Manifest {
    permissions?: Permission[];
  }

  /**
   * Five permissions can each ask the person, in a dialog on the first
   * call that needs it (it opens when the person is at the app's window, and
   * the call waits until they answer). While `"full-access"` is allowed, the
   * others the page lists usually read `"granted"` with no dialog. One the
   * person said no to stays `"denied"`, and an older Claude desktop app, or an
   * Allow given on one, still asks for each, so check each one's state and do
   * not assume it from `"full-access"`. An Allow lasts until a newer
   * published version of the artifact loads (an overlay style comes off
   * then) and its next call that needs it asks again;
   * a "Don't allow" is kept for every version and the call rejects `EPERM`
   * from then on, so build the page to work without. These names
   * live on `desktop.permissions` only: the built-in
   * `claude.use("permissions")` does not know them and answers
   * `"unavailable"`.
   * - `"full-access"`: {@link ClaudeDesktop.fs},
   *   {@link ClaudeDesktop.childProcess}, {@link ClaudeDesktop.pty},
   *   {@link ClaudeDesktop.shell} and `os.info()` with its fields.
   *   The dialog warns that the app can run programs and change files on
   *   this computer. `"full-access"` can be allowed only on an artifact of
   *   the person's own organization that no one outside it has written in,
   *   or, for outsiders, one written only by an owner Anthropic has approved.
   *   Otherwise, or if this cannot be confirmed, asking shows a notice with
   *   no Allow, and the state then reads `"unavailable"` in this window. An
   *   earlier Allow goes on hold if the artifact stops qualifying. So a page
   *   meant for people outside the organization must work without it: tell
   *   whoever asked before you build one.
   * - `"overlay"`: a floating widget. `window.setIgnoreMouseEvents`,
   *   `window.setVisibleOnAllWorkspaces`, {@link ClaudeDesktop.screen}, and
   *   `window.setOptions` with `frame: false`, `transparent` or
   *   `alwaysOnTop`.
   * - `"shortcuts"`: `globalShortcut.register`.
   * - `"notifications"`: `notification.show`.
   * - `"menu-bar"`: `tray.set`, an item at the right of the macOS menu bar, or
   *   on Windows an icon in the system tray.
   * Everything else needs no permission.
   */
  type Permission =
    | "notifications"
    | "shortcuts"
    | "overlay"
    | "menu-bar"
    | "full-access";

  /** `"granted"`, `"prompt"` (not asked yet, or allowed only on another
   *  published version), `"denied"` (the person said
   *  no; offer {@link Permissions.manage} behind a button) or
   *  `"unavailable"` (not declared; turned off; `"full-access"` refused in
   *  this window; not known yet while
   *  the app signs in or learns the page's version, so ask again later; or an
   *  organization other than the one this window was opened under is selected
   *  in the Claude desktop app, so ask again once the person switches back). */
  type PermissionState = "granted" | "prompt" | "denied" | "unavailable";

  /**
   * The code a rejected call's `message` starts with, as `"CODE: detail"`:
   * - `ENOENT` and the other file-system codes, as Node reports them.
   * - `EINVAL`: bad arguments.
   * - `EPERM`: the person said no; `"full-access"` is refused in this window;
   *   the page did not declare the permission;
   *   its state is not known yet (`"unavailable"` while the app signs in or
   *   learns the page's version); or an organization other than the one this
   *   window was opened under is selected in the Claude desktop app. In the
   *   last two cases a later call may pass.
   * - `EAGAIN`: the artifact already holds 32 of its shared slots: running
   *   processes and terminals, registered shortcuts, a standing application
   *   menu, an open popup menu and the menu bar item each take one.
   * - `ENOSYS`: the call is turned off for this person or on their system.
   * - `ENOTSUP`: the window cannot do that now, such as asking the person
   *   while it is hidden, or calling `window.setOptions` or
   *   `window.getOptions` while the Claude desktop app is signed out or has
   *   selected an organization other than the one this window was opened under.
   * - `EBUSY`: another call of the same kind is still running (such as a
   *   second `shell.openPath` within a second). `window.print` may also give
   *   it while the window is not focused or a dialog is open on it, and on
   *   Windows `window.print` and `Menu.popup` may in the few seconds after the
   *   window gets focus, before the person clicks or types in the page.
   * - `ECANCELED`: the window is hidden or minimized (`window.place`), or the
   *   person dismissed what the call asked.
   * - `ESRCH`: the child process or terminal has already exited.
   * - `EEXIST`, `EISDIR`, `EFBIG` (a file over the read cap) and the other
   *   file-system codes, as Node reports them.
   * Not exhaustive.
   */
  type ErrorCode =
    | "ENOENT"
    | "EINVAL"
    | "EPERM"
    | "EAGAIN"
    | "ENOSYS"
    | "ENOTSUP"
    | "EBUSY"
    | "ECANCELED"
    | "ESRCH"
    | "EEXIST"
    | "EISDIR"
    | "EFBIG"
    | (string & {});

  interface Permissions {
    /** One permission's state, without asking. */
    state(name: Permission): Promise<PermissionState>;
    /** All five by name, without asking. */
    state(): Promise<Record<Permission, PermissionState>>;
    /** Asks now for the listed permissions that are still at `"prompt"`
     *  (every declared one with no list) and resolves the same map;
     *  rejects `ENOTSUP` while the window is hidden. */
    request(names?: Permission[]): Promise<Record<Permission, PermissionState>>;
    /** Opens the app's Permissions dialog, where the person turns each on
     *  or off, and resolves when it closes. It needs a click or key press in
     *  the window (or a pick of one of the app's own menu, menu bar or Dock
     *  menu items; a press of its global shortcut does not count) just
     *  before, or rejects `EPERM` (`ENOTSUP` while the window is hidden).
     *  Offer it behind a button when something the app needs reads
     *  `"denied"`. */
    manage(): Promise<void>;
  }

  /**
   * Electron's BrowserWindow option names, and `dragHeight`. One bad or
   * unknown option refuses the whole call (`EINVAL`). `trafficLightPosition`
   * only with a hidden title bar; `dragHeight` (the strip at the top that
   * drags the window, 28 by default) only with a hidden title bar, or `0`
   * with `frame: false` to have no strip; `transparent` needs `frame:
   * false`; `alwaysOnTop` not with a hidden title bar (use `frame: false`);
   * `visualEffectState` needs `vibrancy`; `backgroundColor` is `"#rrggbb"`
   * only. `frame: false`, `transparent` and `alwaysOnTop` need the
   * `"overlay"` permission. Sizes are kept inside the screen. On Windows
   * `titleBarStyle`, `trafficLightPosition`, `vibrancy` and `visualEffectState`
   * are checked as above and then do nothing: only `frame: false` drops the
   * title bar.
   */
  interface WindowOptions {
    titleBarStyle?: "default" | "hidden" | "hiddenInset";
    trafficLightPosition?: { x: number; y: number };
    dragHeight?: number;
    frame?: boolean;
    transparent?: boolean;
    alwaysOnTop?: boolean;
    vibrancy?:
      | "under-window"
      | "under-page"
      | "sidebar"
      | "content"
      | "hud"
      | "popover"
      | "window"
      | "titlebar"
      | "header"
      | "menu"
      | "sheet"
      | "selection"
      | "tooltip"
      | "fullscreen-ui";
    visualEffectState?: "followWindow" | "active" | "inactive";
    movable?: boolean;
    resizable?: boolean;
    minimizable?: boolean;
    maximizable?: boolean;
    fullscreenable?: boolean;
    hasShadow?: boolean;
    roundedCorners?: boolean;
    backgroundColor?: string;
    width?: number;
    height?: number;
    minWidth?: number;
    minHeight?: number;
    maxWidth?: number;
    maxHeight?: number;
  }

  type Corner = "top_left" | "top_right" | "bottom_left" | "bottom_right";

  /** Either `anchor` (move there, `margin` from the screen's edge) or `pin`
   *  (a corner that stays put while the size changes, `top_left` when left
   *  out), never both. */
  type Placement =
    | {
        anchor: Corner | "center";
        margin?: number;
        width?: number;
        height?: number;
      }
    | { pin?: Corner; width?: number; height?: number };

  interface Bounds {
    x: number;
    y: number;
    width: number;
    height: number;
  }

  interface AppWindow {
    /**
     * Replaces any earlier options. Call it once while the page loads and
     * catch its failure: options that differ from the ones the window has
     * rebuild the window and reload the page, so always pass the same
     * options or the page reloads forever. `applied` is `"now"`, or
     * `"next_open"` when the options were only saved for the next time the
     * app opens. That is what happens during the install itself, when the
     * window is still hidden and {@link place} rejects too: on `"next_open"`
     * call setOptions again later, or ask the person to quit the app and open
     * it again (closing its window may leave it running). The page says what
     * drags its window in CSS, as an Electron app does: `app-region: drag` on
     * the title area and `app-region: no-drag` on the controls inside it.
     */
    setOptions(options: WindowOptions): Promise<{
      applied: "now" | "next_open";
      reloading: boolean;
      options: WindowOptions;
    }>;
    /** `options` are the saved ones, `applied` the ones this window really
     *  has: compare with `applied` before skipping setOptions. */
    getOptions(): Promise<{ options: WindowOptions; applied: WindowOptions }>;
    /** Moves or resizes without a reload and resolves the size the window
     *  now has (kept inside the screen and the window's own limits);
     *  rejects `ECANCELED` while the window is hidden or minimized. */
    place(placement: Placement): Promise<{ width: number; height: number }>;
    /** The window comes up; it takes the keyboard only right after the
     *  person pressed something of the app's (a menu or menu bar item, its
     *  global shortcut), once per press. */
    show(): Promise<void>;
    /** May do nothing and still resolve, for example in full screen, while a
     *  dialog is open or, on Windows, in the few seconds after the window comes
     *  up or gets focus, before the person clicks or types in the page. */
    hide(): Promise<void>;
    getBounds(): Promise<Bounds>;
    setBounds(bounds: Partial<Bounds>): Promise<void>;
    /** The system print dialog, laid out like the viewer's Export to PDF;
     *  resolves whether the page printed. It may reject: `ENOTSUP` or `EBUSY`
     *  while the window is hidden or minimized, `EBUSY` while it is not focused
     *  or a dialog is open on it, and on Windows `EBUSY` in the few seconds
     *  after the window gets focus, before the person clicks or types in the
     *  page. Call it from their click or key press in the page; on Windows a
     *  pick of the app's menu or tray item, or a press of its global shortcut,
     *  also lets one call through right after it, focused or not, while the
     *  window is on screen. */
    print(): Promise<boolean>;
    /** Needs `"overlay"`. */
    setIgnoreMouseEvents(
      ignore: boolean,
      options?: { forward?: boolean },
    ): Promise<void>;
    /** Needs `"overlay"`. Does nothing on Windows. */
    setVisibleOnAllWorkspaces(
      visible: boolean,
      options?: { visibleOnFullScreen?: boolean },
    ): Promise<void>;
  }

  /**
   * Electron's menu template: `label`, `submenu`, `role`, `type`,
   * `accelerator`, `checked`, `enabled`, `visible`, `click`, plus `href`. An accelerator
   * needs Command or Control in it (`"CmdOrCtrl+E"`; `EINVAL` otherwise)
   * and does nothing while its item is hidden. An Edit role item (`cut`,
   * `copy`, `paste`, `selectAll`...) or one that acts past your window
   * (`about`, `services`, `hide`, `hideOthers`, `unhide`, `front`) keeps the
   * system's name and keys whatever label or accelerator you give.
   *
   * `href` is an http(s) URL that a pick of the item opens in the browser,
   * whether or not the window is on screen (not a press of its accelerator,
   * and not on an item with a `role`); a link the artifact could not open
   * is `EINVAL`. `click` still runs, and the item it gets has `opened: true`
   * when the pick handed the link to the browser, so a page can fall back
   * to `window.show()` in a desktop app that predates `href`.
   */
  interface MenuItem {
    label?: string;
    submenu?: MenuItem[];
    role?: string;
    type?: "normal" | "separator" | "submenu" | "checkbox" | "radio";
    accelerator?: string;
    checked?: boolean;
    enabled?: boolean;
    visible?: boolean;
    href?: string;
    click?: (item: {
      label?: string;
      checked?: boolean;
      role?: string;
      opened?: boolean;
    }) => void;
  }

  interface Menu {
    /**
     * The macOS menu bar while the window is focused, after a first menu
     * Claude builds itself (About, Settings, the app's Permissions, Quit):
     * leave out `appMenu` and `quit` roles and any Command+Q or
     * Option+Command+Escape chord, which are dropped or refused, and keep
     * `{role: "editMenu"}`, which is what makes Cmd+C, Cmd+V and Cmd+X work.
     * `null` restores the default.
     */
    setApplicationMenu(template: MenuItem[] | null): Promise<void>;
    /**
     * A context menu at the pointer, while the window is focused with the
     * pointer over it (`ENOTSUP` otherwise); resolves after it closes and
     * any click ran. Call it from a `contextmenu` listener after
     * `event.preventDefault()`, with your own items or the Edit roles other
     * than `paste` and `pasteAndMatchStyle` (`EINVAL`; for Paste in a text
     * field, let the `contextmenu` event through and the app's own menu
     * shows with it).
     */
    popup(template: MenuItem[]): Promise<void>;
  }

  /**
   * The installed app's own Dock tile. `setBadge` resolves `true` only
   * while the app runs from its tile. `setProgress` and `setMenu` are
   * accepted but the tile shows neither yet: both resolve `false`.
   */
  interface Dock {
    /** A square PNG `data:` URL, 16 to 1024 px, under 256 KB; call it
     *  while the page loads. `written` says whether an installed copy of
     *  the app took the icon now; the icon is kept for an install either
     *  way. */
    setIcon(pngDataUrl: string): Promise<{ written: boolean }>;
    /** Up to 24 characters; `""` clears. */
    setBadge(text: string): Promise<boolean>;
    /** Accepted, not shown: resolves `false`. */
    setProgress(fraction: number): Promise<boolean>;
    /** Accepted, not shown: resolves `false`. */
    setMenu(template: MenuItem[] | null): Promise<boolean>;
  }

  interface DirEntry {
    name: string;
    isFile: boolean;
    isDirectory: boolean;
    isSymbolicLink: boolean;
  }

  interface Stats {
    size: number;
    mode: number;
    mtimeMs: number;
    ctimeMs: number;
    birthtimeMs: number;
    isFile: boolean;
    isDirectory: boolean;
    isSymbolicLink: boolean;
  }

  /** Needs `"full-access"`. Named after Node's fs/promises but not the
   *  same shapes: stats and directory entries carry boolean flags, not
   *  methods, `readdir` always returns entries, and `exists` is extra.
   *  `rm` and `rmdir` delete for good, and `writeFile`, `rename` and
   *  `copyFile` replace an existing file with no warning (`exists` tells
   *  whether one is there). For the person's own files prefer
   *  {@link Shell.trashItem} to `rm`; the top of this file says when a page
   *  shows what it will do first. */
  interface Fs {
    readFile(path: string, encoding: "utf8" | "base64"): Promise<string>;
    readFile(path: string): Promise<Uint8Array>;
    writeFile(
      path: string,
      data: string | Uint8Array,
      encoding?: "utf8" | "base64",
    ): Promise<void>;
    appendFile(
      path: string,
      data: string | Uint8Array,
      encoding?: "utf8" | "base64",
    ): Promise<void>;
    readdir(path: string): Promise<DirEntry[]>;
    stat(path: string): Promise<Stats>;
    lstat(path: string): Promise<Stats>;
    exists(path: string): Promise<boolean>;
    mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
    rm(
      path: string,
      options?: { recursive?: boolean; force?: boolean },
    ): Promise<void>;
    rmdir(path: string): Promise<void>;
    rename(from: string, to: string): Promise<void>;
    copyFile(from: string, to: string): Promise<void>;
    realpath(path: string): Promise<string>;
  }

  /** Shaped like Node's ChildProcess. `kill`, `stdin.write` and `stdin.end`
   *  wait until the process has started, which can wait on the person. */
  interface ChildProcess {
    pid: Promise<number | null>;
    stdout: { on(event: "data", listener: (chunk: string) => void): void };
    stderr: { on(event: "data", listener: (chunk: string) => void): void };
    stdin: { write(data: string): Promise<unknown>; end(): Promise<unknown> };
    on(
      event: "exit" | "close",
      listener: (code: number | null, signal: string | null) => void,
    ): void;
    on(event: "error", listener: (error: Error) => void): void;
    /** `SIGTERM` when left out; any other signal is `EINVAL`. */
    kill(
      signal?: "SIGTERM" | "SIGKILL" | "SIGINT" | "SIGHUP",
    ): Promise<unknown>;
  }

  /** Needs `"full-access"`. Takes one of the artifact's 32 shared slots
   *  while it runs (`EAGAIN`; see {@link ErrorCode}). A command the page
   *  itself chose that can delete or overwrite the person's data (such as
   *  `rm`, `del` or a `>` redirect) is one to show them before it runs; one
   *  they asked for by name needs no question (see the top of this file). */
  interface ChildProcesses {
    exec(
      command: string,
      options?: {
        cwd?: string;
        env?: Record<string, string>;
        timeout?: number;
        input?: string;
      },
    ): Promise<{
      stdout: string;
      stderr: string;
      code: number | null;
      signal: string | null;
      truncated: boolean;
    }>;
    /** Returns at once; a refusal arrives as its `error` event. */
    spawn(
      command: string,
      args?: string[],
      options?: { cwd?: string; env?: Record<string, string>; shell?: boolean },
    ): ChildProcess;
  }

  /** Shaped like node-pty's IPty. */
  interface PtyProcess {
    pid: Promise<number | null>;
    onData(listener: (data: string) => void): void;
    onExit(listener: (exit: { exitCode: number }) => void): void;
    onError(listener: (error: Error) => void): void;
    write(data: string): Promise<unknown>;
    resize(cols: number, rows: number): Promise<unknown>;
    kill(): Promise<unknown>;
  }

  /** Needs `"full-access"`. */
  interface Pty {
    /** The person's login shell (on Windows, PowerShell) when `file` is left
     *  out; `cols` 2 to 500, `rows` 1 to 300, here and in `resize`. Returns at
     *  once; a refusal arrives through `onError`. */
    spawn(
      file?: string,
      args?: string[],
      options?: {
        cols?: number;
        rows?: number;
        cwd?: string;
        env?: Record<string, string>;
      },
    ): PtyProcess;
  }

  interface OsInfo {
    platform: string;
    arch: string;
    release: string;
    hostname: string;
    homedir: string;
    tmpdir: string;
    username: string;
    cpus: number;
    totalmem: number;
    uptime: number;
  }

  interface Os {
    /** No permission needed. */
    platform(): Promise<string>;
    /** No permission needed. */
    arch(): Promise<string>;
    /** Needs `"full-access"`, as do the per-field getters below. */
    info(): Promise<OsInfo>;
    release(): Promise<string>;
    hostname(): Promise<string>;
    homedir(): Promise<string>;
    tmpdir(): Promise<string>;
    username(): Promise<string>;
    cpus(): Promise<number>;
    totalmem(): Promise<number>;
    uptime(): Promise<number>;
  }

  /** Needs `"full-access"`. */
  interface Shell {
    /** Opens a document in its app. A program, script or app bundle rejects
     *  `EPERM`: run those with {@link ChildProcesses}. One at a time and at
     *  most one a second, else `EBUSY`. */
    openPath(path: string): Promise<void>;
    showItemInFolder(path: string): Promise<void>;
    /** Moves a file or folder to the Trash (on Windows the Recycle Bin),
     *  where the person can get it back: prefer it to {@link Fs.rm} for the
     *  person's own files. It can reject, for example where there is no Trash
     *  (some network drives); say so rather than fall back to `fs.rm`
     *  unasked. */
    trashItem(path: string): Promise<void>;
  }

  interface Display {
    id: number;
    label: string;
    bounds: Bounds;
    workArea: Bounds;
    size: { width: number; height: number };
    workAreaSize: { width: number; height: number };
    scaleFactor: number;
    rotation: number;
    internal: boolean;
  }

  /** Needs `"overlay"`. */
  interface Screen {
    getCursorScreenPoint(): Promise<{ x: number; y: number }>;
    getAllDisplays(): Promise<Display[]>;
  }

  interface GlobalShortcut {
    /** Needs `"shortcuts"`. The accelerator is two or more modifiers and a
     *  key (`"Alt+Shift+G"`), never a VoiceOver, Escape or Command+Q chord
     *  (`EINVAL`); resolves whether it was registered. On Windows
     *  `CmdOrCtrl` is Control, and a chord with Control+Alt, Command (the
     *  Windows key), Tab, Print Screen, Num Lock, Insert or Caps Lock is
     *  `EINVAL` too. That leaves Control+Shift or Alt+Shift and a key. Each
     *  registered chord holds a shared slot until unregistered (`EAGAIN`). */
    register(accelerator: string, callback: () => void): Promise<boolean>;
    /** No permission needed. */
    unregister(accelerator: string): Promise<void>;
    /** No permission needed. */
    unregisterAll(): Promise<void>;
  }

  /** Needs `"notifications"`. */
  interface Notifications {
    /** Plain text of up to 300 characters. */
    show(options: { body: string }): Promise<void>;
  }

  /** A `Menu.popup`-style template with no roles: `label`, `type`,
   *  `enabled`, `checked`, `submenu`, `click`, `href`. An item with
   *  `href` opens that link in the browser when picked, window hidden or
   *  not: a menu bar item joins a call or opens a page in one pick. */
  type TrayMenuItem = Omit<MenuItem, "role" | "accelerator" | "visible">;

  interface TrayOptions {
    /** A square PNG `data:` URL like the Dock icon's, drawn 18 points high.
     *  A template by default: macOS paints its alpha in the menu bar's own
     *  color, so draw it black on transparent. One with nothing visible in
     *  it is refused. `icon` or `title` is required; Windows draws no title,
     *  so give an icon. */
    icon?: string;
    /** `false` for a colored icon. */
    iconIsTemplate?: boolean;
    /** Up to 30 characters, shown beside or instead of the icon (on Windows,
     *  in the tooltip). */
    title?: string;
    /** Up to 100 characters, shown on a line under "Artifact: <the app's
     *  name>", which the tooltip always begins with. */
    toolTip?: string;
    /** Opened by a press of the item. With no menu, a press calls
     *  {@link click} instead. On Windows, Claude adds Show App, Permissions
     *  and Exit after your items, and with no menu a right click opens just
     *  those, so only a left click calls {@link click}. */
    menu?: TrayMenuItem[];
    /** Called on a press when there is no `menu` (say, one that brings the
     *  window back with `window.show()`). */
    click?: () => void;
  }

  /** An item at the right of the macOS menu bar, like a status app's, or on
   *  Windows an icon in the system tray, while the page is loaded. It goes
   *  when the page reloads or the window closes, so set it on every load. On
   *  Windows it can stay a few seconds after a reload or `remove()`. */
  interface Tray {
    /** Needs `"menu-bar"`. Puts the item up, or changes the one already
     *  there; resolves `true`. */
    set(options: TrayOptions): Promise<boolean>;
    /** Takes it down. No permission needed. */
    remove(): Promise<void>;
  }
}

interface ClaudeCapabilityMap {
  desktop: ClaudeDesktop;
}
