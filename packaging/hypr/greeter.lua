-- ── Hyprland for the login screen ─────────────────────────────────────────────
-- A separate, minimal config: the compositor is only here to put one layer-shell
-- window on screen. No wallpaper, animations, blur or window layouts — the
-- greeter draws all of it.
--
-- My main config (~/.config/hypr/hyprland.lua) has nothing to do with this: the
-- greeter runs as the `greeter` user, who has no access to ~.
--
-- Written in Lua rather than hyprlang: 0.56 warns that the old format goes away
-- in 0.57. Docs: https://wiki.hypr.land/Configuring/

hl.monitor({
    output   = "",
    mode     = "preferred",
    position = "auto",
    scale    = "auto",
})

hl.config({
    general = {
        border_size = 0,
        gaps_in     = 0,
        gaps_out    = 0,
    },

    decoration = {
        rounding = 0,
        shadow = {
            enabled = false,
        },
        blur = {
            -- There is nothing to blur: the wallpaper lives inside our own
            -- surface, and GTK blurs it itself (see picture.screen-bg in
            -- shared/style/_base.scss).
            enabled = false,
        },
    },

    animations = {
        enabled = false,
    },

    misc = {
        disable_hyprland_logo   = true,
        disable_splash_rendering = true,
        force_default_wallpaper = 0,
        disable_autoreload      = true,
    },

    input = {
        kb_layout    = "us,ru",
        kb_options   = "grp:caps_toggle",
        repeat_rate  = 35,
        repeat_delay = 300,
        follow_mouse = 1,
    },

    cursor = {
        hide_on_key_press = false,
    },
})

-- Render at more than 8 bits per channel where the hardware allows it. The scrim
-- is a gradient spanning the whole screen, and in 8 bits it crosses only about
-- fifty levels — each one a 40px band with a dead-straight edge, which the eye
-- picks up as a grid over the smooth blurred wallpaper. With the extra depth the
-- steps become too fine to see. This panel already runs at 10 bpc (XRGB2101010).
--
-- GDK_DEBUG is where GTK keeps this switch; it is a documented option, not a
-- diagnostic one, and there is no other way to ask for it.
hl.env("GDK_DEBUG", "high-depth")

hl.env("XCURSOR_SIZE", "24")
hl.env("HYPRCURSOR_SIZE", "24")
hl.env("XDG_SESSION_TYPE", "wayland")
hl.env("XDG_CURRENT_DESKTOP", "Hyprland")

-- The login screen, and the exit right after it. ags quits on its own once the
-- login succeeds (see GreeterWindow.tsx), and the dispatch brings this Hyprland
-- down — only then does greetd start the chosen session.
--
-- The dispatcher is written in Lua because that is what hyprctl expects from a
-- Lua-configured Hyprland; the single quotes keep the shell out of it.
hl.on("hyprland.start", function()
    hl.exec_cmd([[ags run /usr/share/my-greeter/greeter/app.ts; hyprctl dispatch 'hl.dsp.exit()']])
end)
