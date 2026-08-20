import os
import sys
import json
import mimetypes
import urllib.parse
from http.server import HTTPServer, BaseHTTPRequestHandler

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

import sync_cartola
from standings_engine import recalculate_standings_from_matches
ROOT_DIR = os.path.dirname(BASE_DIR)
DATA_DIR = os.path.join(BASE_DIR, "data")
PUBLIC_DIR = os.path.join(ROOT_DIR, "public")

PORT = int(os.environ.get("PORT", 8080))

# Credenciais
USERS = {
    "Lendas": {"senha": "458021", "role": "admin", "nome": "Administrador Lendas"},
    "Lendas1234": {"senha": "", "role": "user", "nome": "Usuário Lendas1234"}
}

def load_json(filename):
    path = os.path.join(DATA_DIR, filename)
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}

def save_json(filename, data):
    path = os.path.join(DATA_DIR, filename)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

class CartolaApiHandler(BaseHTTPRequestHandler):
    
    def _send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")

    def do_OPTIONS(self):
        self.send_response(200)
        self._send_cors_headers()
        self.end_headers()

    def _send_json(self, data, status_code=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self._send_cors_headers()
        self.end_headers()
        self.wfile.write(body)

    def _send_error_json(self, message, status_code=400):
        self._send_json({"error": True, "mensagem": message}, status_code=status_code)

    def _serve_file(self, filepath):
        if not os.path.exists(filepath) or os.path.isdir(filepath):
            self.send_response(404)
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(b"404 Not Found")
            return
        
        mime, _ = mimetypes.guess_type(filepath)
        if not mime:
            mime = "application/octet-stream"
        
        with open(filepath, "rb") as f:
            content = f.read()

        self.send_response(200)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(content)))
        self._send_cors_headers()
        self.end_headers()
        self.wfile.write(content)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        # Endpoints da API Pública
        if path == "/api" or path == "/api/":
            self._send_json({
                "nome": "API Unificada Futebol Cartola 2026",
                "versao": "2.1.0",
                "status": "Operacional",
                "endpoints": {
                    "mercado_status": "/api/mercado/status",
                    "atletas_mercado": "/api/atletas/mercado",
                    "partidas": "/api/partidas",
                    "clubes": "/api/clubes",
                    "clube_escalacao": "/api/clubes/{id}/escalacao",
                    "taticas": "/api/taticas",
                    "pitch_positions": "/api/pitch/positions",
                    "posicoes": "/api/posicoes",
                    "status": "/api/status",
                    "esquemas": "/api/esquemas",
                    "export_banco": "/api/admin/export"
                }
            })
            return

        if path == "/api/mercado/status":
            self._send_json(load_json("mercado_status.json"))
            return

        if path == "/api/top_destaques":
            self._send_json(load_json("top_destaques.json") or [])
            return

        if path == "/api/clubes":
            self._send_json(load_json("clubes.json"))
            return

        if path == "/api/posicoes":
            self._send_json(load_json("posicoes.json"))
            return

        if path == "/api/status":
            self._send_json(load_json("status.json"))
            return

        if path == "/api/config":
            config = load_json("config.json")
            if not config:
                config = {"foto_mode": "local"}
            self._send_json(config)
            return

        if path == "/api/esquemas":
            self._send_json(load_json("esquemas.json"))
            return

        if path == "/api/taticas":
            self._send_json(load_json("taticas.json"))
            return

        if path == "/api/pitch/positions":
            self._send_json(load_json("pitch_positions.json"))
            return

        if path == "/api/meu-time":
            self._send_json(load_json("meu_time.json"))
            return

        if path == "/api/partidas" or path.startswith("/api/partidas/"):
            partidas = load_json("partidas.json")
            clubes_list = load_json("clubes.json")
            clubes = {c["id"]: c for c in clubes_list} if isinstance(clubes_list, list) else clubes_list
            mercado = load_json("mercado_status.json")
            
            res = []
            for p in partidas:
                item = dict(p)
                item["clube_casa"] = clubes.get(p.get("clube_casa_id"), {})
                item["clube_visitante"] = clubes.get(p.get("clube_visitante_id"), {})
                res.append(item)
            
            self._send_json({
                "rodada": mercado.get("rodada_atual", 23),
                "total_jogos": len(res),
                "partidas": res
            })
            return

        if path == "/api/atletas/mercado" or path == "/api/atletas":
            atletas = load_json("atletas.json")
            clubes_list = load_json("clubes.json")
            clubes = {c["id"]: c for c in clubes_list} if isinstance(clubes_list, list) else clubes_list
            posicoes = load_json("posicoes.json")
            status_map = load_json("status.json")

            clube_id = query.get("clube_id", [None])[0]
            posicao_id = query.get("posicao_id", [None])[0]
            status_id = query.get("status_id", [None])[0]

            filtered = []
            for a in atletas:
                if clube_id and str(a["clube_id"]) != str(clube_id):
                    continue
                if posicao_id and str(a["posicao_id"]) != str(posicao_id):
                    continue
                if status_id and str(a["status_id"]) != str(status_id):
                    continue
                
                item = dict(a)
                item["clube"] = clubes.get(a["clube_id"], {})
                item["posicao"] = posicoes.get(str(a["posicao_id"]), {})
                item["status_info"] = status_map.get(str(a["status_id"]), {})
                filtered.append(item)

            self._send_json({
                "total": len(filtered),
                "atletas": filtered,
                "clubes": clubes,
                "posicoes": posicoes,
                "status": status_map
            })
            return

        if path.startswith("/api/clubes/") and path.endswith("/escalacao"):
            parts = path.split("/")
            try:
                club_id = int(parts[3])
            except ValueError:
                self._send_error_json("ID de clube inválido", 400)
                return

            atletas = load_json("atletas.json")
            clubes_list = load_json("clubes.json")
            clubes = {c["id"]: c for c in clubes_list} if isinstance(clubes_list, list) else clubes_list
            taticas = load_json("taticas.json")
            
            clube = clubes.get(club_id)
            if not clube:
                self._send_error_json("Clube não encontrado", 404)
                return

            club_atletas = [a for a in atletas if a["clube_id"] == club_id]
            provaveis = [a for a in club_atletas if a["status_id"] == 7]
            duvidas = [a for a in club_atletas if a["status_id"] == 2]
            lesionados = [a for a in club_atletas if a["status_id"] == 5]
            suspensos = [a for a in club_atletas if a["status_id"] == 3]

            self._send_json({
                "clube": clube,
                "esquema_tatico": taticas.get(str(club_id), "4-3-3"),
                "total_atletas": len(club_atletas),
                "provaveis": provaveis,
                "duvidas": duvidas,
                "lesionados": lesionados,
                "suspensos": suspensos,
                "todos": club_atletas
            })
            return

        if path == "/api/confrontos-h2h" or path.startswith("/api/confrontos-h2h/"):
            h2h_data = load_json("confrontos_h2h.json")
            if path.startswith("/api/confrontos-h2h/"):
                pid = path.split("/")[-1]
                match_h2h = h2h_data.get(str(pid))
                if not match_h2h:
                    self._send_error_json("Confronto não encontrado", 404)
                    return
                self._send_json(match_h2h)
                return
            
            partida_id_q = query.get("partida_id", [None])[0]
            if partida_id_q:
                match_h2h = h2h_data.get(str(partida_id_q))
                self._send_json(match_h2h or {})
                return
            
            self._send_json(h2h_data)
            return

        if path == "/api/meu-time":
            meu_time = load_json("meu_time.json")
            self._send_json(meu_time or {})
            return

        if path == "/api/classificacao":
            classificacao = load_json("classificacao.json")
            self._send_json(classificacao or {})
            return

        # Export backup
        if path == "/api/admin/export":
            full_db = {
                "mercado": load_json("mercado_status.json"),
                "clubes": load_json("clubes.json"),
                "atletas": load_json("atletas.json"),
                "partidas": load_json("partidas.json"),
                "taticas": load_json("taticas.json"),
                "pitch_positions": load_json("pitch_positions.json"),
                "posicoes": load_json("posicoes.json"),
                "status": load_json("status.json")
            }
            self._send_json(full_db)
            return

        # Servir imagens (/images/Flamengo/...)
        if path.startswith("/images/"):
            rel_path = path[len("/images/"):]
            rel_path = urllib.parse.unquote(rel_path)
            file_path = os.path.join(ROOT_DIR, rel_path)
            if not os.path.exists(file_path):
                file_path = os.path.join(PUBLIC_DIR, "images", rel_path)
            if not os.path.exists(file_path):
                file_path = os.path.join(ROOT_DIR, "images", rel_path)
            self._serve_file(file_path)
            return

        if path == "/mascote.png":
            file_path = os.path.join(PUBLIC_DIR, "images", "mascote.png")
            if not os.path.exists(file_path):
                file_path = os.path.join(ROOT_DIR, "mascote.png")
            self._serve_file(file_path)
            return

        # Servir Frontend
        if path == "/" or path == "":
            path = "/index.html"
        
        clean_path = path.lstrip("/")
        file_path = os.path.join(PUBLIC_DIR, clean_path)

        if not os.path.exists(file_path):
            file_path = os.path.join(PUBLIC_DIR, "index.html")

        self._serve_file(file_path)

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        
        content_len = int(self.headers.get("Content-Length", 0))
        post_body = self.rfile.read(content_len)

        # Autenticação
        if path == "/api/auth/login":
            try:
                payload = json.loads(post_body.decode("utf-8"))
                username = payload.get("username", "").strip()
                password = payload.get("password", "").strip()

                if username == "Lendas":
                    if password == "458021":
                        self._send_json({
                            "sucesso": True,
                            "role": "admin",
                            "username": "Lendas",
                            "token": "token-admin-lendas-458021"
                        })
                        return
                    else:
                        self._send_error_json("Senha incorreta para o administrador Lendas.", 401)
                        return
                
                if username == "Lendas1234":
                    # Usuário comum sem senha obrigatória
                    self._send_json({
                        "sucesso": True,
                        "role": "user",
                        "username": "Lendas1234",
                        "token": "token-user-lendas-1234"
                    })
                    return

                self._send_error_json("Usuário não encontrado. Use Lendas ou Lendas1234.", 401)
            except Exception as e:
                self._send_error_json(str(e), 500)
            return

        # Sincronizar com Cartola Oficial
        if path == "/api/admin/sync-cartola":
            try:
                result = sync_cartola.sync_cartola_data()
                self._send_json({"sucesso": True, "detalhes": result})
            except Exception as e:
                self._send_error_json(f"Erro ao sincronizar com Cartola: {str(e)}", 500)
            return

        # Salvar Esquema Tático do Clube (4-3-3, 4-4-2, 3-5-2, etc.)
        if path == "/api/admin/tatica":
            try:
                payload = json.loads(post_body.decode("utf-8"))
                club_id = str(payload.get("clube_id"))
                formacao = payload.get("formacao", "4-3-3")

                taticas = load_json("taticas.json")
                taticas[club_id] = formacao
                save_json("taticas.json", taticas)

                self._send_json({"sucesso": True, "formacao": formacao})
            except Exception as e:
                self._send_error_json(str(e), 500)
            return

        # Salvar Coordenadas Personalizadas dos Jogadores no Campinho Arrastável
        if path == "/api/admin/pitch/positions":
            try:
                payload = json.loads(post_body.decode("utf-8"))
                club_id = str(payload.get("clube_id"))
                positions = payload.get("positions", {})

                pitch_coords = load_json("pitch_positions.json")
                pitch_coords[club_id] = positions
                save_json("pitch_positions.json", pitch_coords)

                self._send_json({"sucesso": True, "mensagem": "Posições do campinho salvas!"})
            except Exception as e:
                self._send_error_json(str(e), 500)
            return

        # Salvar/Alternar Fonte de Escudo do Clube (Oficial vs Custom Upload)
        if path == "/api/admin/clube/escudo":
            try:
                payload = json.loads(post_body.decode("utf-8"))
                club_id = int(payload.get("clube_id"))
                escudo_url = payload.get("escudo_url")

                clubes = load_json("clubes.json")
                for c in clubes:
                    if c["id"] == club_id:
                        c["escudo"] = escudo_url
                        break
                save_json("clubes.json", clubes)

                custom_escudos = load_json("custom_escudos.json")
                custom_escudos[str(club_id)] = escudo_url
                save_json("custom_escudos.json", custom_escudos)

                self._send_json({"sucesso": True, "escudo": escudo_url})
            except Exception as e:
                self._send_error_json(str(e), 500)
            return

        # Atualizar status de um atleta
        if path == "/api/admin/atleta/status":
            try:
                payload = json.loads(post_body.decode("utf-8"))
                atleta_id = int(payload["atleta_id"])
                novo_status = int(payload["status_id"])

                atletas = load_json("atletas.json")
                found = False
                for a in atletas:
                    if a["atleta_id"] == atleta_id:
                        a["status_id"] = novo_status
                        found = True
                        break
                
                if not found:
                    self._send_error_json("Atleta não encontrado", 404)
                    return
                
                save_json("atletas.json", atletas)

                # Salvar em overrides persistentes
                overrides = load_json("admin_overrides.json")
                if "status" not in overrides:
                    overrides["status"] = {}
                overrides["status"][str(atleta_id)] = novo_status
                save_json("admin_overrides.json", overrides)

                self._send_json({"sucesso": True, "mensagem": "Status atualizado com sucesso!"})
            except Exception as e:
                self._send_error_json(str(e), 500)
            return

        # Configuração Global (Modo de Foto: local vs cartola)
        if path == "/api/admin/config":
            try:
                payload = json.loads(post_body.decode("utf-8"))
                foto_mode = payload.get("foto_mode", "local")
                config = load_json("config.json")
                if not config:
                    config = {}
                config["foto_mode"] = foto_mode
                save_json("config.json", config)

                # Atualizar fotos em atletas.json se existirem foto_local e foto_cartola
                atletas = load_json("atletas.json")
                for a in atletas:
                    fl = a.get("foto_local")
                    fc = a.get("foto_cartola")
                    if foto_mode == "local" and fl:
                        a["foto"] = fl
                    elif foto_mode == "cartola" and fc:
                        a["foto"] = fc
                save_json("atletas.json", atletas)

                self._send_json({"sucesso": True, "foto_mode": foto_mode, "mensagem": f"Modo de fotos atualizado para: {foto_mode}"})
            except Exception as e:
                self._send_error_json(str(e), 500)
            return

        # Salvar alterações do elenco em lote (Botão Salvar da Tabela do Elenco)
        if path == "/api/admin/elenco/salvar-lote":
            try:
                payload = json.loads(post_body.decode("utf-8"))
                alteracoes = payload.get("alteracoes", [])
                
                atletas = load_json("atletas.json")
                atletas_map = {a["atleta_id"]: a for a in atletas}
                
                overrides = load_json("admin_overrides.json")
                if "status" not in overrides:
                    overrides["status"] = {}

                atualizados_count = 0
                for item in alteracoes:
                    aid = int(item["atleta_id"])
                    st = int(item["status_id"])
                    if aid in atletas_map:
                        atletas_map[aid]["status_id"] = st
                        overrides["status"][str(aid)] = st
                        atualizados_count += 1
                
                save_json("atletas.json", list(atletas_map.values()))
                save_json("admin_overrides.json", overrides)

                self._send_json({"sucesso": True, "atualizados": atualizados_count, "mensagem": f"{atualizados_count} atletas salvos com sucesso!"})
            except Exception as e:
                self._send_error_json(str(e), 500)
            return

        # Adicionar novo jogador
        if path == "/api/admin/atleta/novo":
            try:
                payload = json.loads(post_body.decode("utf-8"))
                atletas = load_json("atletas.json")
                
                max_id = max([a["atleta_id"] for a in atletas]) if atletas else 1000
                new_id = max_id + 1

                preco = float(payload.get("preco_num", 5.0))
                novo_atleta = {
                    "atleta_id": new_id,
                    "nome": payload.get("nome", "Novo Jogador"),
                    "apelido": payload.get("apelido", payload.get("nome", "Novo Jogador")),
                    "foto": payload.get("foto", f"https://api.dicebear.com/7.x/avataaars/svg?seed={new_id}"),
                    "rodada_id": 23,
                    "clube_id": int(payload["clube_id"]),
                    "posicao_id": int(payload["posicao_id"]),
                    "status_id": int(payload.get("status_id", 7)),
                    "pontos_num": 0.0,
                    "media_num": 4.5,
                    "media_casa": 4.8,
                    "media_fora": 4.2,
                    "media_basica": 3.0,
                    "preco_num": preco,
                    "variacao_num": 0.0,
                    "jogos_num": 1,
                    "scout": {"G": 0, "A": 0, "DS": 2, "FS": 1},
                    "historico_7_rodadas": [
                        {"rodada": 22, "pontos": 4.5, "mando": "casa", "adversario": "INT"},
                        {"rodada": 21, "pontos": 5.0, "mando": "fora", "adversario": "PAL"},
                        {"rodada": 20, "pontos": 3.8, "mando": "casa", "adversario": "COR"}
                    ]
                }

                atletas.append(novo_atleta)
                save_json("atletas.json", atletas)
                self._send_json({"sucesso": True, "atleta": novo_atleta})
            except Exception as e:
                self._send_error_json(str(e), 500)
            return

        # Upload de Imagem
        if path == "/api/admin/upload":
            try:
                import base64
                payload = json.loads(post_body.decode("utf-8"))
                folder_name = payload.get("folder", "Flamengo")
                subfolder = payload.get("subfolder", "Atacantes")
                filename = payload.get("filename", "player.png")
                b64_data = payload.get("image_base64", "")

                if "," in b64_data:
                    b64_data = b64_data.split(",")[1]

                img_bytes = base64.b64decode(b64_data)
                
                target_dir = os.path.join(ROOT_DIR, folder_name, subfolder)
                os.makedirs(target_dir, exist_ok=True)
                
                file_dest = os.path.join(target_dir, filename)
                with open(file_dest, "wb") as f:
                    f.write(img_bytes)

                public_url = f"/images/{folder_name}/{subfolder}/{filename}"
                self._send_json({"sucesso": True, "url": public_url})
            except Exception as e:
                self._send_error_json(str(e), 500)
            return

        # Salvar escalação do Meu Time
        if path == "/api/meu-time":
            try:
                payload = json.loads(post_body.decode("utf-8"))
                save_json("meu_time.json", payload)
                self._send_json({"sucesso": True, "meu_time": payload})
            except Exception as e:
                self._send_error_json(str(e), 500)
            return

        # Salvar Confrontos Diretos e Últimos 5 Jogos (H2H)
        if path == "/api/admin/confrontos-h2h":
            try:
                payload = json.loads(post_body.decode("utf-8"))
                partida_id = str(payload.get("partida_id"))
                if not partida_id:
                    self._send_error_json("ID de partida obrigatório", 400)
                    return
                
                h2h_db = load_json("confrontos_h2h.json")
                if not h2h_db:
                    h2h_db = {}
                
                h2h_db[partida_id] = payload
                save_json("confrontos_h2h.json", h2h_db)
                self._send_json({"sucesso": True, "mensagem": "Dados do confronto e histórico de jogos salvos com sucesso!", "confronto": payload})
            except Exception as e:
                self._send_error_json(str(e), 500)
            return

        # Upload de Imagem 500x500 ou PDF do Confronto
        if path == "/api/admin/upload-h2h-image":
            try:
                import base64
                payload = json.loads(post_body.decode("utf-8"))
                partida_id = str(payload.get("partida_id"))
                filename = payload.get("filename", f"confronto_{partida_id}.png")
                b64_data = payload.get("image_base64", "")

                if "," in b64_data:
                    b64_data = b64_data.split(",")[1]

                file_bytes = base64.b64decode(b64_data)
                
                target_dir = os.path.join(PUBLIC_DIR, "images", "h2h")
                os.makedirs(target_dir, exist_ok=True)
                
                ext = os.path.splitext(filename)[1].lower() or ".png"
                clean_filename = f"h2h_{partida_id}{ext}"
                file_dest = os.path.join(target_dir, clean_filename)
                
                with open(file_dest, "wb") as f:
                    f.write(file_bytes)

                public_url = f"/images/h2h/{clean_filename}"

                # Atualizar em confrontos_h2h.json
                h2h_db = load_json("confrontos_h2h.json")
                if partida_id in h2h_db:
                    h2h_db[partida_id]["imagem_custom_500x500"] = public_url
                    save_json("confrontos_h2h.json", h2h_db)

                self._send_json({"sucesso": True, "url": public_url, "mensagem": "Imagem do confronto salva com sucesso!"})
            except Exception as e:
                self._send_error_json(str(e), 500)
            return

        # Salvar / Atualizar Tabela de Classificação do Brasileirão
        if path == "/api/admin/classificacao":
            try:
                payload = json.loads(post_body.decode("utf-8"))
                save_json("classificacao.json", payload)
                self._send_json({"sucesso": True, "mensagem": "Tabela de classificação salva com sucesso!", "classificacao": payload})
            except Exception as e:
                self._send_error_json(str(e), 500)
            return

        # Salvar Placar de Partida e Recalcular Automaticamente a Classificação
        if path == "/api/admin/partidas/salvar-placar":
            try:
                payload = json.loads(post_body.decode("utf-8"))
                partida_id = payload.get("partida_id")
                pm = payload.get("placar_mandante")
                pv = payload.get("placar_visitante")

                partidas = load_json("partidas.json")
                if not isinstance(partidas, list):
                    partidas = []

                partida_encontrada = None
                prev_pm = None
                prev_pv = None
                cid_casa = None
                cid_fora = None

                for p in partidas:
                    if str(p.get("partida_id")) == str(partida_id):
                        prev_pm = p.get("placar_oficial_mandante")
                        prev_pv = p.get("placar_oficial_visitante")
                        cid_casa = p.get("clube_casa_id")
                        cid_fora = p.get("clube_visitante_id")
                        p["placar_oficial_mandante"] = int(pm) if pm is not None and str(pm).strip() != "" else None
                        p["placar_oficial_visitante"] = int(pv) if pv is not None and str(pv).strip() != "" else None
                        partida_encontrada = p
                        break

                save_json("partidas.json", partidas)

                # Aplicar na classificação e reordenar
                from standings_engine import apply_match_score_to_standings
                classificacao = load_json("classificacao.json")
                if not classificacao or "tabela" not in classificacao:
                    clubes_list = load_json("clubes.json")
                    if isinstance(clubes_list, dict):
                        clubes_list = list(clubes_list.values())
                    classificacao = recalculate_standings_from_matches(partidas, clubes_list)
                else:
                    if cid_casa and cid_fora:
                        classificacao = apply_match_score_to_standings(
                            classificacao,
                            partida_id,
                            int(pm) if pm is not None and str(pm).strip() != "" else None,
                            int(pv) if pv is not None and str(pv).strip() != "" else None,
                            cid_casa,
                            cid_fora,
                            prev_pm,
                            prev_pv
                        )

                save_json("classificacao.json", classificacao)

                self._send_json({
                    "sucesso": True,
                    "mensagem": "Placar atualizado e tabela de classificação recalculada automaticamente!",
                    "partida": partida_encontrada,
                    "classificacao": classificacao
                })
            except Exception as e:
                self._send_error_json(str(e), 500)
            return

        # Recalcular Tabela a partir de Todas as Partidas
        if path == "/api/admin/classificacao/recalcular":
            try:
                partidas = load_json("partidas.json")
                if not isinstance(partidas, list):
                    partidas = []
                clubes_list = load_json("clubes.json")
                if isinstance(clubes_list, dict):
                    clubes_list = list(clubes_list.values())

                nova_classificacao = recalculate_standings_from_matches(partidas, clubes_list)
                save_json("classificacao.json", nova_classificacao)

                self._send_json({
                    "sucesso": True,
                    "mensagem": "Tabela recalculada com sucesso segundo critérios oficiais!",
                    "classificacao": nova_classificacao
                })
            except Exception as e:
                self._send_error_json(str(e), 500)
            return

        self._send_error_json("Endpoint POST não encontrado", 404)

def run_server():
    server_address = ("", PORT)
    httpd = HTTPServer(server_address, CartolaApiHandler)
    print("==================================================")
    print(f"[*] Servidor Lendas do Cartola 2026 Ativo na porta {PORT}!")
    print(f"[*] Website: http://localhost:{PORT}")
    print(f"[*] Painel Administrativo: http://localhost:{PORT}/admin.html")
    print("==================================================")
    httpd.serve_forever()

if __name__ == "__main__":
    run_server()
