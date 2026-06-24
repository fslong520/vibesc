use serde::Serialize;
use tauri::Manager;

#[derive(Serialize)]
struct PortInfo {
    name: String,
    available: bool,
}

/// 扫描可用串口
/// （硬件功能暂延，预留命令桩）
#[tauri::command]
fn scan_ports() -> Vec<PortInfo> {
    Vec::new()
}

/// 连接串口
#[tauri::command]
fn connect_port(_port: String) -> Result<String, String> {
    Err("硬件功能尚未实现".to_string())
}

/// 断开串口
#[tauri::command]
fn disconnect_port() -> Result<(), String> {
    Err("硬件功能尚未实现".to_string())
}

/// 获取插件目录路径
#[tauri::command]
fn get_plugins_dir(app: tauri::AppHandle) -> Result<String, String> {
    let path = app
        .path()
        .home_dir()
        .map_err(|e| e.to_string())?
        .join(".scratchmind")
        .join("plugins");
    std::fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

/// 获取项目保存目录路径
#[tauri::command]
fn get_projects_dir(app: tauri::AppHandle) -> Result<String, String> {
    let path = app
        .path()
        .home_dir()
        .map_err(|e| e.to_string())?
        .join(".scratchmind")
        .join("projects");
    std::fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            scan_ports,
            connect_port,
            disconnect_port,
            get_plugins_dir,
            get_projects_dir,
        ])
        .run(tauri::generate_context!())
        .expect("启动 ScratchMind 失败");
}
