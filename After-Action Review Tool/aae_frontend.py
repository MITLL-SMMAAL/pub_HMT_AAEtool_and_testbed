import os
import subprocess
from quart import Quart, send_file, websocket, abort

app = Quart(__name__)

# Load configuration
config = {
    'public_dir': 'public',
    'games_dir': 'games/minecraft',
    'favicon_file': 'favicon.ico',  # Changed to use actual favicon.ico
}

@app.route("/")
async def serve_iframe():
    return await send_file(os.path.join(config["public_dir"], "mcraft_iframe.html"))

@app.route("/loading")
async def serve_loading():
    return await send_file(os.path.join(config["public_dir"], "loading.html"))

@app.route("/aae")
async def serve_aae():
    return await send_file(os.path.join(config["public_dir"], "aae.html"))

@app.route('/favicon.ico')
async def favicon():
    try:
        return await send_file(
            os.path.join(config["public_dir"], config["favicon_file"]),
            mimetype='image/x-icon'
        )
    except FileNotFoundError:
        abort(404)

@app.route("/<path:filename>")
async def serve_asset(filename):
    # First, check if it's an HTML file
    if filename.endswith('.html'):
        try:
            return await send_file(os.path.join(config["public_dir"], filename))
        except FileNotFoundError:
            abort(404)
    
    # Handle other static assets
    if filename.endswith((".js", ".css", ".mp4", ".webp", ".webm", ".txt", ".json")):
        if (
            filename.endswith(".mp4")
            or filename.endswith(".webm")
            or filename.endswith(".txt")
            or filename.endswith(".json")
        ):
            try:
                return await send_file(
                    os.path.join(config["games_dir"], filename), conditional=True
                )
            except FileNotFoundError:
                abort(404)
        else:
            try:
                return await send_file(os.path.join(config["public_dir"], filename))
            except FileNotFoundError:
                abort(404)
    else:
        abort(404)

@app.errorhandler(404)
async def not_found(error):
    return {"error": "Resource not found"}, 404

if __name__ == '__main__':
    app.run(debug=False, port=8082, use_reloader=False)