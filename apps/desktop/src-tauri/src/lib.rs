/// Point d'entrée Tauri : fenêtre native + notifications système.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .run(tauri::generate_context!())
        .expect("erreur au lancement de Kairos");
}
