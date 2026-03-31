const Applet = imports.ui.applet;
const Settings = imports.ui.settings;
const Gettext = imports.gettext;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;

const UUID = "docker-space@mithereal";
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(str) {
    return Gettext.dgettext(UUID, str);
}

function MyApplet(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _path: '',
    _timeout: null,

    selectedType: "Images",
    refreshInterval: 10,
    showTotal: false,

    _init: function(metadata, orientation, panel_height, instance_id) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        this._path = metadata.path;

        this._bind_settings(instance_id);

        this.set_applet_tooltip(_("Docker Space"));

        this._update();
        this._start_loop();
    },

    // -------------------------
    // Settings
    // -------------------------
    _bind_settings: function(instance_id) {
        let settings = new Settings.AppletSettings(this, UUID, instance_id);

        settings.bindProperty(Settings.BindingDirection.IN,
            "selectedType",
            "selectedType",
            this._update,
            null
        );

        settings.bindProperty(Settings.BindingDirection.IN,
            "refreshInterval",
            "refreshInterval",
            this._restart_loop,
            null
        );

        settings.bindProperty(Settings.BindingDirection.IN,
            "showTotal",
            "showTotal",
            this._update,
            null
        );
    },

    // -------------------------
    // Loop
    // -------------------------
    _start_loop: function() {
        this._restart_loop();
    },

    _restart_loop: function() {
        if (this._timeout) {
            Mainloop.source_remove(this._timeout);
        }

        this._update();

        this._timeout = Mainloop.timeout_add_seconds(this.refreshInterval || 10, () => {
            this._update();
            return true;
        });
    },

    // -------------------------
    // Docker Data
    // -------------------------
    _get_docker_data: function() {
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

            for (let i = 0; i < lines.length; i++) {
                try {
                    let obj = JSON.parse(lines[i]);
                    result[obj.Type] = obj.Size;
                } catch (e) {}
            }

            return result;
        } catch (e) {
            global.logError(e);
            return null;
        }
    },

    // -------------------------
    // Size parsing
    // -------------------------
    _toGB: function(size) {
        if (!size) return 0;

        let m = size.match(/([0-9.]+)([KMGTP]?B)/i);
        if (!m) return 0;

        let val = parseFloat(m[1]);
        let unit = m[2].toUpperCase();

        let map = {
            KB: 1 / (1024 * 1024),
            MB: 1 / 1024,
            GB: 1,
            TB: 1024
        };

        return val * (map[unit] || 0);
    },

    _total: function(data) {
        let total = 0;
        for (let k in data) {
            total += this._toGB(data[k]);
        }
        return total;
    },

    // -------------------------
    // Icon progress bar effect
    // -------------------------
    _set_icon_by_usage: function(percent) {
        let level = Math.min(100, Math.max(0, Math.floor(percent)));

        let icon = "whale.png"; // base icon

        // Optional: you can swap icons like:
        // whale-20.png, whale-40.png, etc.
        if (level > 80) icon = "whale-full.png";
        else if (level > 60) icon = "whale-75.png";
        else if (level > 40) icon = "whale-50.png";
        else if (level > 20) icon = "whale-25.png";
        else icon = "whale.png";

        this.set_applet_icon_path(this._path + "/icons/" + icon);
    },

    // -------------------------
    // Update
    // -------------------------
    _update: function() {
        let data = this._get_docker_data();

        if (!data) {
            this.set_applet_label("N/A");
            this.set_applet_tooltip(_("Docker not available"));
            return;
        }

        let display = "";
        let gb = 0;

        if (this.showTotal) {
            gb = this._total(data);
            display = gb.toFixed(1) + " GB";
        } else {
            display = data[this.selectedType] || "?";
            gb = this._toGB(display);
        }

        let totalGB = this._total(data);
        let percent = totalGB > 0 ? (gb / totalGB) * 100 : 0;

        this.set_applet_label(display);

        this._set_icon_by_usage(percent);

        let tooltip = "";
        for (let k in data) {
            tooltip += k + ": " + data[k] + "\n";
        }

        tooltip += "Total: " + totalGB.toFixed(2) + " GB";
        this.set_applet_tooltip(tooltip);
    },

    // -------------------------
    // Click
    // -------------------------
    on_applet_clicked: function() {
        this._update();
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    return new MyApplet(metadata, orientation, panel_height, instance_id);
}