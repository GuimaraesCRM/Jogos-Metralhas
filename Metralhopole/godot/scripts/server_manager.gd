class_name ServerManager
extends Node

var process_id := -1

func ensure_local_server() -> bool:
	if process_id > 0 and OS.is_process_running(process_id): return true
	var executable_dir := OS.get_executable_path().get_base_dir()
	var packaged_node := executable_dir.path_join("server/node.exe")
	var packaged_script := executable_dir.path_join("server/server.js")
	var root_script := packaged_script if FileAccess.file_exists(packaged_script) else ProjectSettings.globalize_path("res://../server.js")
	var node_path := packaged_node if FileAccess.file_exists(packaged_node) else "C:/Program Files/nodejs/node.exe"
	if not FileAccess.file_exists(node_path):
		var candidates: Array = []; OS.execute("where", ["node"], candidates, true)
		if not candidates.is_empty(): node_path = str(candidates[0]).split("\n")[0].strip_edges()
	if not FileAccess.file_exists(node_path) or not FileAccess.file_exists(root_script): return false
	if node_path == packaged_node:
		var command := "& '%s' '%s'" % [node_path.replace("'", "''"), root_script.replace("'", "''")]
		process_id = OS.create_process("powershell.exe", ["-NoProfile", "-WindowStyle", "Hidden", "-Command", command], false)
	else: process_id = OS.create_process(node_path, [root_script], false)
	await get_tree().create_timer(0.65).timeout
	return process_id > 0 and OS.is_process_running(process_id)

func _exit_tree() -> void:
	if process_id > 0 and OS.is_process_running(process_id): OS.kill(process_id)
