const Applet = imports.ui.applet;
const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;

class DockerSpaceApplet extends Applet.TextIconApplet {
constructor(metadata, orientation, panelHeight, instanceId) {
super(orientation, panelHeight, instanceId);

    this.setAllowedLayout(Applet.AllowedLayout.BOTH);

    this.settings = new Settings.AppletSettings(this, metadata.uuid, instanceId);
    this.settings.bind("selectedType", "selectedType", this._onSettingsChanged);
    this.settings.bind("refreshInterval", "refreshInterval", this._restartLoop);
    this.settings.bind("showTotal", "showTotal", this._onSettingsChanged);
    this.settings.bind("colorize", "colorize", this._onSettingsChanged);

    this.set_applet_icon_name("docker");
    this.set_applet_tooltip("Docker disk usage");

    this._buildMenu();
    this._restartLoop();
}

_restartLoop() {
    if (this._timeout) {
        Mainloop.source_remove(this._timeout);
    }

    this._update();
    this._timeout = Mainloop.timeout_add_seconds(this.refreshInterval || 10, () => {
        this._update();
        return true;
    });
}

_getDockerData() {
    try {
        if (!GLib.find_program_in_path("docker")) {
            return null;
        }

        let [ok, out] = GLib.spawn_command_line_sync(
            "docker system df --format '{{json .}}'"
        );

        if (!ok) return null;

        let lines = imports.byteArray.toString(out).trim().split("\n");
        let result = {};

        lines.forEach(line => {
            try {
                let obj = JSON.parse(line);
                result[obj.Type] = obj.Size;
            } catch (_) {}
        });

        return result;
    } catch (e) {
        global.logError(e);
        return null;
    }
}

_parseSizeToGB(sizeStr) {
    if (!sizeStr) return 0;

    let match = sizeStr.match(/([0-9.]+)([KMGTP]?B)/i);
    if (!match) return 0;

    let value = parseFloat(match[1]);
    let unit = match[2].toUpperCase();

    const map = {
        KB: 1 / (1024 * 1024),
        MB: 1 / 1024,
        GB: 1,
        TB: 1024
    };

    return value * (map[unit] || 0);
}

_getTotalGB(data) {
    return Object.values(data)
        .map(v => this._parseSizeToGB(v))
        .reduce((a, b) => a + b, 0);
}

_applyColor(gb) {
    if (!this.colorize) return;

    let color = "white";
    if (gb > 20) color = "red";
    else if (gb > 10) color = "orange";
    else if (gb > 5) color = "yellow";

    this.actor.set_style(`color: ${color};`);
}

_update() {
    let data = this._getDockerData();

    if (!data) {
        this.set_applet_label("N/A");
        this.set_applet_tooltip("Docker not available");
        return;
    }

    let display;
    let gbValue = 0;

    if (this.showTotal) {
        gbValue = this._getTotalGB(data);
        display = `${gbValue.toFixed(1)} GB`;
    } else {
        display = data[this.selectedType] || "?";
        gbValue = this._parseSizeToGB(display);
    }

    this.set_applet_label(display);
    this._applyColor(gbValue);

    let tooltip = Object.entries(data)
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n");

    tooltip += `\nTotal: ${this._getTotalGB(data).toFixed(2)} GB`;

    this.set_applet_tooltip(tooltip);
}

_buildMenu() {
    this.menu = new Applet.AppletPopupMenu(this, this.orientation);
    this.menuManager.addMenu(this.menu);

    const types = ["Images", "Containers", "Local Volumes", "Build Cache"];

    types.forEach(type => {
        let item = new PopupMenu.PopupMenuItem(type);
        item.connect("activate", () => {
            this.selectedType = type;
            this.settings.setValue("selectedType", type);
            this._update();
        });
        this.menu.addMenuItem(item);
    });

    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    let pruneItem = new PopupMenu.PopupMenuItem("Cleanup (docker system prune -f)");
    pruneItem.connect("activate", () => {
        GLib.spawn_command_line_async("docker system prune -f");
    });

    this.menu.addMenuItem(pruneItem);
}

on_applet_clicked() {
    this.menu.toggle();
}

_onSettingsChanged() {
    this._update();
}

}

function main(metadata, orientation, panelHeight, instanceId) {
return new DockerSpaceApplet(metadata, orientation, panelHeight, instanceId);
}
