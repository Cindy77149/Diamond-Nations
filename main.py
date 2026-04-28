from __future__ import annotations

import json
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, HTTPException, Path as FPath
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field


ROOT = Path(__file__).resolve().parent
DATA_DIR = Path.home() / '.diamond_nations' / 'saves'
DATA_DIR.mkdir(parents=True, exist_ok=True)
STATIC_DATA_DIR = ROOT / 'data'

_ALLOWED_RESOURCES = {'players', 'nations', 'packs', 'coaches', 'eras'}


class SaveEnvelope(BaseModel):
    label: str | None = None
    source: str | None = 'browser'
    save: dict = Field(default_factory=dict)


def slot_path(slot: int) -> Path:
    return DATA_DIR / f'slot_{slot}.json'


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def build_slot_meta(slot: int, payload: dict) -> dict:
    ts = payload.get('_ts')
    updated_at = datetime.fromtimestamp(ts / 1000, timezone.utc).isoformat() if isinstance(ts, (int, float)) else iso_now()
    return {
        'slot': slot,
        'label': payload.get('_label') or ('🔄 自動存檔' if slot == 0 else f'手動存檔 {slot}'),
        'nation': payload.get('_natName'),
        'flag': payload.get('_natFlag'),
        'collection_count': payload.get('_collectionCount'),
        'ovr': payload.get('_ovr'),
        'updated_at': updated_at,
    }


def load_slot_payload(slot: int) -> dict:
    path = slot_path(slot)
    if not path.exists():
        raise HTTPException(status_code=404, detail='找不到這個存檔槽')
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail='存檔內容損毀') from exc


def list_all_slots() -> list[dict]:
    slots = []
    for path in sorted(DATA_DIR.glob('slot_*.json')):
        try:
            slot = int(path.stem.split('_')[-1])
            payload = json.loads(path.read_text(encoding='utf-8'))
            slots.append(build_slot_meta(slot, payload))
        except Exception:
            continue
    return slots


def write_slot_atomic(path: Path, payload: dict) -> None:
    fd, tmp_name = tempfile.mkstemp(dir=path.parent, suffix='.tmp')
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
        os.replace(tmp_name, path)
    except Exception:
        os.unlink(tmp_name)
        raise


app = FastAPI(title='Diamond Nations API', version='1.0.0')
app.add_middleware(
    CORSMiddleware,
    # 'null' 是 file:// 直接開 index.html 時瀏覽器送出的 origin
    allow_origins=['http://127.0.0.1:8000', 'http://localhost:8000', 'null'],
    allow_credentials=False,
    allow_methods=['GET', 'POST', 'DELETE'],
    allow_headers=['Content-Type'],
)


@app.get('/api/data/{resource}')
def get_data(resource: str):
    if resource not in _ALLOWED_RESOURCES:
        raise HTTPException(status_code=404, detail=f'資料資源 "{resource}" 不存在')
    path = STATIC_DATA_DIR / f'{resource}.json'
    if not path.exists():
        raise HTTPException(status_code=404, detail=f'找不到 {resource}.json')
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail='資料檔案損毀') from exc


@app.get('/api/health')
def health():
    return {
        'ok': True,
        'app': 'Diamond Nations API',
        'version': '1.0.0',
        'game_version': 'v6.1.0',
        'saved_slots': list_all_slots(),
        'server_time': iso_now(),
    }


@app.get('/api/saves')
def list_saves():
    return {'items': list_all_slots()}


@app.get('/api/saves/{slot}')
def get_save(slot: int = FPath(ge=0, le=9)):
    payload = load_slot_payload(slot)
    return {
        'slot': slot,
        'meta': build_slot_meta(slot, payload),
        'save': payload,
    }


@app.post('/api/saves/{slot}')
def put_save(slot: int = FPath(ge=0, le=9), envelope: SaveEnvelope = ...):
    payload = dict(envelope.save)
    payload.setdefault('_label', envelope.label or ('🔄 自動存檔' if slot == 0 else f'手動存檔 {slot}'))
    payload['_serverSavedAt'] = iso_now()
    write_slot_atomic(slot_path(slot), payload)
    return {
        'ok': True,
        'slot': slot,
        'meta': build_slot_meta(slot, payload),
        'source': envelope.source,
    }


@app.delete('/api/saves/{slot}')
def delete_save(slot: int = FPath(ge=0, le=9)):
    path = slot_path(slot)
    if path.exists():
        path.unlink()
    return {'ok': True, 'slot': slot}


app.mount('/', StaticFiles(directory=str(ROOT), html=True), name='frontend')
