// Masque la console sous Windows en mode release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    kairos_desktop_lib::run()
}
