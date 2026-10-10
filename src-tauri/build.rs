fn main() {
    // dist/ (the bundled UI) is git-ignored, but generate_context! needs the folder to
    // exist. `pnpm run dev` / `build` fill it first; a plain `cargo test` or `cargo check`
    // on a fresh clone (and rust-analyzer) gets an empty one instead of a compile error.
    let dist = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../dist");
    let _ = std::fs::create_dir_all(dist);
    tauri_build::build()
}
