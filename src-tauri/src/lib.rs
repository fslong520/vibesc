use serde::Serialize;
use std::sync::Mutex;
use tauri::Manager;

struct AppState {
    agnes_api_key: Mutex<Option<String>>,
}

#[derive(Serialize)]
struct PortInfo {
    name: String,
    available: bool,
}

/// 获取 Agnes API 密钥
#[tauri::command]
fn get_agnes_key(state: tauri::State<AppState>) -> Result<String, String> {
    let key = state.agnes_api_key.lock().map_err(|e| e.to_string())?;
    key.clone().ok_or_else(|| "AGNES_API_KEY 未设置".to_string())
}

/// 释放内存/资源（JS GC 触发时调用）
#[tauri::command]
fn collect_garbage() {
    // Tauri v2 中 WRY WebView 会自行管理
}

/// 扫描可用串口（硬件功能暂延）
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
    let api_key = std::env::var("AGNES_API_KEY").ok();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(AppState {
            agnes_api_key: Mutex::new(api_key),
        })
        .invoke_handler(tauri::generate_handler![
            get_agnes_key,
            collect_garbage,
            scan_ports,
            connect_port,
            disconnect_port,
            get_plugins_dir,
            get_projects_dir,
        ])
        .run(tauri::generate_context!())
        .expect("启动 VibeSc 失败");
}
