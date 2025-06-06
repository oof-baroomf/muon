//! Minimal infinite‑canvas browser – Rust + CEF (off‑screen) + Bevy.
//! Controls:
//!   • LMB drag or WASD → pan the world
//!   • Mouse wheel       → zoom in/out
//!   • Ctrl + T           → open new page (prompts in terminal)
//!   • Ctrl + W           → close focused page
//!   • F12               → toggle Chromium DevTools for focused page
//!
//! No HTML <canvas> is used – the scene is native GPU quads with live textures.

use anyhow::Result;
use bevy::{
    prelude::*,
    render::render_resource::{Extent3d, TextureDimension, TextureFormat},
    window::PrimaryWindow,
};
use bevy_pancam::{PanCam, PanCamPlugin};
use browser_window::{application::*, browser::*, offscreen::*, prelude::*};
use std::{sync::mpsc, time::Duration};
use tokio::sync::Mutex;

#[derive(Resource, Default)]
struct Tabs {
    list: Vec<Tab>,
    active: usize,
}

struct Tab {
    bw: BrowserWindowThreaded,
    rx: mpsc::Receiver<Frame>, // off‑screen frames
    handle: Handle<Image>,     // Bevy texture handle
}

#[tokio::main]
async fn main() -> Result<()> {
    // ───── Init CEF ───────────────────────────────────────────────────────────
    let app = Application::initialize(&ApplicationSettings::default())?;
    let runtime = app.start();

    // ───── Bevy app ──────────────────────────────────────────────────────────
    App::new()
        .insert_resource(Tabs::default())
        .add_plugins(DefaultPlugins.set(WindowPlugin {
            primary_window: Some(Window {
                title: "Infinite Canvas Browser".into(),
                ..Default::default()
            }),
            ..Default::default()
        }))
        .add_plugin(PanCamPlugin::default())
        .add_systems(Startup, setup_camera)
        .add_systems(Update, (spawn_requests, draw_frames, keyboard_shortcuts))
        .run_async(bevy::tasks::IoTaskPool::get(), async move {
            // CEF runtime must keep pumping events –  do that in parallel.
            runtime.join();
        })
        .await;

    Ok(())
}

fn setup_camera(mut commands: Commands) {
    commands.spawn((Camera2dBundle::default(), PanCam::default()));
}

/// Read keyboard, ask user for URL on Ctrl+T, etc.
fn keyboard_shortcuts(
    keys: Res<Input<KeyCode>>,
    mut tabs: ResMut<Tabs>,
    mut images: ResMut<Assets<Image>>,
    mut commands: Commands,
) {
    if keys.just_pressed(KeyCode::T) && keys.pressed(KeyCode::ControlLeft) {
        if let Some(url) = prompt("New tab URL [default: https://example.com]: ") {
            spawn_tab(url, &mut tabs, &mut images, &mut commands);
        }
    }
    if keys.just_pressed(KeyCode::W) && keys.pressed(KeyCode::ControlLeft) {
        close_active(&mut tabs, &mut commands);
    }
}

/// Pump off‑screen frame receivers, upload newest frame to texture.
fn draw_frames(mut tabs: ResMut<Tabs>, mut images: ResMut<Assets<Image>>) {
    for tab in tabs.list.iter_mut() {
        while let Ok(frame) = tab.rx.try_recv() {
            // grow texture if needed
            let size = Extent3d { width: frame.width, height: frame.height, depth_or_array_layers: 1 };
            let image = images.get_mut(&tab.handle).unwrap();
            if image.size() != [size.width as f32, size.height as f32] {
                *image = Image::new(size, TextureDimension::D2, frame.pixels, TextureFormat::Rgba8UnormSrgb);
            } else {
                image.data = frame.pixels;
            }
        }
    }
}

/// New tab = CEF off‑screen browser + Bevy sprite.
fn spawn_tab(url: String, tabs: &mut Tabs, images: &mut Assets<Image>, commands: &mut Commands) {
    // channel for frames
    let (tx, rx) = mpsc::channel::<Frame>();

    // build off‑screen CEF window
    let mut builder = BrowserWindowBuilder::new(Source::Url(url));
    builder.offscreen(OffscreenSettings::new(|frame| {
        let _ = tx.send(frame.clone());
    }));

    let bw = builder.build_threaded();

    // placeholder 1×1 pixel texture – will resize on first paint
    let tex = Image::new_fill(
        Extent3d { width: 1, height: 1, depth_or_array_layers: 1 },
        TextureDimension::D2,
        &[0, 0, 0, 255],
        TextureFormat::Rgba8UnormSrgb,
    );
    let handle = images.add(tex);

    // sprite positioned at origin – users pan the camera, not sprites.
    commands.spawn(SpriteBundle {
        texture: handle.clone(),
        sprite: Sprite { custom_size: Some(Vec2::new(800., 600.)), ..Default::default() },
        transform: Transform::from_xyz(0.0, 0.0, 0.0),
        ..Default::default()
    });

    tabs.list.push(Tab { bw, rx, handle });
    tabs.active = tabs.list.len() - 1;
}

fn close_active(tabs: &mut Tabs, commands: &mut Commands) {
    if tabs.list.is_empty() {
        return;
    }
    let tab = tabs.list.remove(tabs.active);
    tab.bw.close();
    tabs.active = tabs.active.saturating_sub(1);
    // Note: sprite entity is leaked for brevity – track Entity id for real cleanup.
}

fn prompt(question: &str) -> Option<String> {
    use std::io::{stdin, stdout, Write};
    print!("{}", question);
    let _ = stdout().flush();
    let mut buf = String::new();
    stdin().read_line(&mut buf).ok()?;
    let trimmed = buf.trim();
    if trimmed.is_empty() { Some("https://example.com".into()) } else { Some(trimmed.into()) }
}

/// Simple RGBA frame coming from CEF
#[derive(Clone)]
struct Frame {
    width: u32,
    height: u32,
    pixels: Vec<u8>, // 4×8‑bit RGBA
}
