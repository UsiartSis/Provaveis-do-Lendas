import os
import json
import uuid

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
WORKSPACE_DIR = os.path.dirname(BASE_DIR)
DATA_DIR = os.path.join(BASE_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)

# 20 Clubes da Série A 2026
CLUBS_RAW = [
    {"id": 262, "nome": "Flamengo", "abreviacao": "FLA", "slug": "flamengo", "folder": "Flamengo", "cores": ["#C3281E", "#000000"]},
    {"id": 266, "nome": "Fluminense", "abreviacao": "FLU", "slug": "fluminense", "folder": "Fluminense", "cores": ["#8A1538", "#006233"]},
    {"id": 264, "nome": "Corinthians", "abreviacao": "COR", "slug": "corinthians", "folder": "Corinthians", "cores": ["#000000", "#FFFFFF"]},
    {"id": 275, "nome": "Palmeiras", "abreviacao": "PAL", "slug": "palmeiras", "folder": "Palmeiras", "cores": ["#006437", "#FFFFFF"]},
    {"id": 276, "nome": "São Paulo", "abreviacao": "SAO", "slug": "sao-paulo", "folder": "SaoPaulo", "cores": ["#BA0C2F", "#000000"]},
    {"id": 277, "nome": "Santos", "abreviacao": "SAN", "slug": "santos", "folder": "Santos", "cores": ["#000000", "#FFFFFF"]},
    {"id": 263, "nome": "Botafogo", "abreviacao": "BOT", "slug": "botafogo", "folder": "Botafogo", "cores": ["#000000", "#FFFFFF"]},
    {"id": 267, "nome": "Vasco", "abreviacao": "VAS", "slug": "vasco", "folder": "Vasco", "cores": ["#000000", "#FFFFFF"]},
    {"id": 282, "nome": "Atlético-MG", "abreviacao": "CAM", "slug": "atletico-mg", "folder": "AtleticoMG", "cores": ["#000000", "#FFFFFF"]},
    {"id": 283, "nome": "Cruzeiro", "abreviacao": "CRU", "slug": "cruzeiro", "folder": "Cruzeiro", "cores": ["#003A94", "#FFFFFF"]},
    {"id": 284, "nome": "Grêmio", "abreviacao": "GRE", "slug": "gremio", "folder": "Gremio", "cores": ["#0D80BF", "#000000"]},
    {"id": 285, "nome": "Internacional", "abreviacao": "INT", "slug": "internacional", "folder": "Internacional", "cores": ["#E5050F", "#FFFFFF"]},
    {"id": 265, "nome": "Bahia", "abreviacao": "BAH", "slug": "bahia", "folder": "Bahia", "cores": ["#0055A5", "#ED1C24"]},
    {"id": 356, "nome": "Fortaleza", "abreviacao": "FOR", "slug": "fortaleza", "folder": "Fortaleza", "cores": ["#11388E", "#D91B24"]},
    {"id": 293, "nome": "Athletico-PR", "abreviacao": "CAP", "slug": "athletico-pr", "folder": "AthleticoPR", "cores": ["#C8102E", "#000000"]},
    {"id": 294, "nome": "Coritiba", "abreviacao": "CFC", "slug": "coritiba", "folder": "Coritiba", "cores": ["#005A36", "#FFFFFF"]},
    {"id": 373, "nome": "Red Bull Bragantino", "abreviacao": "BGT", "slug": "bragantino", "folder": "Bragantino", "cores": ["#D00000", "#FFFFFF"]},
    {"id": 315, "nome": "Vitória", "abreviacao": "VIT", "slug": "vitoria", "folder": "Vitoria", "cores": ["#E30613", "#000000"]},
    {"id": 327, "nome": "Ceará", "abreviacao": "CEA", "slug": "ceara", "folder": "Ceara", "cores": ["#000000", "#FFFFFF"]},
    {"id": 354, "nome": "Juventude", "abreviacao": "JUV", "slug": "juventude", "folder": "Juventude", "cores": ["#008542", "#FFFFFF"]}
]

POSICOES = {
    1: {"id": 1, "nome": "Goleiro", "abreviacao": "gol", "folder": "Goleiros"},
    2: {"id": 2, "nome": "Lateral", "abreviacao": "lat", "folder": "Laterais"},
    3: {"id": 3, "nome": "Zagueiro", "abreviacao": "zag", "folder": "Zagueiros"},
    4: {"id": 4, "nome": "Meia", "abreviacao": "mei", "folder": "Meias"},
    5: {"id": 5, "nome": "Atacante", "abreviacao": "ata", "folder": "Atacantes"},
    6: {"id": 6, "nome": "Técnico", "abreviacao": "tec", "folder": "Tecnico"}
}

STATUS_LIST = {
    7: {"id": 7, "nome": "Provável", "class": "status-provavel", "icone": "check-circle", "cor": "#10b981"},
    2: {"id": 2, "nome": "Dúvida", "class": "status-duvida", "icone": "help-circle", "cor": "#f59e0b"},
    5: {"id": 5, "nome": "Contundido/Lesionado", "class": "status-lesionado", "icone": "alert-triangle", "cor": "#ef4444"},
    3: {"id": 3, "nome": "Suspenso", "class": "status-suspenso", "icone": "x-circle", "cor": "#dc2626"},
    6: {"id": 6, "nome": "Nulo", "class": "status-nulo", "icone": "minus-circle", "cor": "#6b7280"}
}

def scan_real_players():
    atletas = []
    atleta_id_counter = 1000

    # Scan Flamengo and Fluminense
    for club in CLUBS_RAW:
        club_dir = os.path.join(WORKSPACE_DIR, club["folder"])
        if not os.path.exists(club_dir):
            continue
        
        # Check escudos
        escudo_file = f"{club['nome']}.png"
        escudo_path = os.path.join(club_dir, escudo_file)
        if os.path.exists(escudo_path):
            club["escudo"] = f"/images/{club['folder']}/{escudo_file}"
        else:
            club["escudo"] = f"https://s.sde.globo.com/media/organizations/teams/{club['abreviacao'].lower()}_65x65.png"

        # Scan subdirectories
        for pos_id, pos_info in POSICOES.items():
            pos_dir = os.path.join(club_dir, pos_info["folder"])
            if not os.path.exists(pos_dir):
                continue
            
            files = os.listdir(pos_dir)
            for f in files:
                if not f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
                    continue
                
                raw_name = os.path.splitext(f)[0]
                display_name = raw_name.replace("_Fut_Prof_Masc", "").replace("_", " ").title().strip()
                
                # Assign status
                status_id = 7 # Provavel default
                if "Pedro" in display_name or "Milla" in display_name or "Andrew" in display_name:
                    status_id = 5 # Lesionado
                elif "Soteldo" in display_name or "Arana" in display_name or "Wallace" in display_name or "Carrascal" in display_name:
                    status_id = 2 # Dúvida
                
                atleta = {
                    "atleta_id": atleta_id_counter,
                    "nome": display_name,
                    "apelido": display_name,
                    "foto": f"/images/{club['folder']}/{pos_info['folder']}/{f}",
                    "rodada_id": 1,
                    "clube_id": club["id"],
                    "posicao_id": pos_id,
                    "status_id": status_id,
                    "pontos_num": round(2.0 + (atleta_id_counter % 12) * 1.15, 2),
                    "media_num": round(3.5 + (atleta_id_counter % 7) * 0.9, 2),
                    "preco_num": round(5.0 + (atleta_id_counter % 15) * 1.2, 2),
                    "variacao_num": round(((atleta_id_counter % 5) - 2) * 0.45, 2),
                    "jogos_num": 1,
                    "scout": {
                        "G": 1 if pos_id == 5 and atleta_id_counter % 3 == 0 else 0,
                        "A": 1 if pos_id in (4, 5) and atleta_id_counter % 4 == 0 else 0,
                        "DS": 2 if pos_id in (2, 3, 4) else 0,
                        "SG": 1 if pos_id in (1, 2, 3) else 0,
                        "FS": 1,
                        "FF": 1
                    }
                }
                atletas.append(atleta)
                atleta_id_counter += 1

    # Populate dummy squad for other 18 clubs so all 20 have players
    sample_names = {
        1: ["Weverton", "Hugo Souza", "John", "Everson", "Cássio", "Marchesín", "Sergio Rochet", "Marcos Felipe", "Cleiton"],
        2: ["Marcos Rocha", "Piquerez", "Matheuzinho", "Guilherme Arana", "Puma Rodríguez", "William", "Reinaldo", "Tinga"],
        3: ["Gustavo Gómez", "Murilo", "Félix Torres", "Lucas Veríssimo", "Bastos", "Junior Alonso", "Kannemann", "Vitão"],
        4: ["Raphael Veiga", "Garro", "Payet", "Lucas Moura", "Pochettino", "Matheus Pereira", "Cristaldo", "Alan Patrick", "Cauly", "Villasanti"],
        5: ["Estêvão", "Yuri Alberto", "Calleri", "Luiz Henrique", "Igor Jesus", "Paulinho", "Braithwaite", "Borré", "Lucero", "Thaciano"],
        6: ["Abel Ferreira", "Ramón Díaz", "Luis Zubeldia", "Artur Jorge", "Gabriel Milito", "Fernando Diniz", "Renato Gaucho", "Roger Machado"]
    }

    for club in CLUBS_RAW:
        if club["nome"] in ["Flamengo", "Fluminense"]:
            continue
        club["escudo"] = f"https://api.dicebear.com/7.x/identicon/svg?seed={club['abreviacao']}"
        
        # Add coach
        atleta_id_counter += 1
        atletas.append({
            "atleta_id": atleta_id_counter,
            "nome": sample_names[6][atleta_id_counter % len(sample_names[6])],
            "apelido": sample_names[6][atleta_id_counter % len(sample_names[6])],
            "foto": f"https://api.dicebear.com/7.x/bottts/svg?seed={club['abreviacao']}_tec",
            "rodada_id": 1,
            "clube_id": club["id"],
            "posicao_id": 6,
            "status_id": 7,
            "pontos_num": 4.5,
            "media_num": 4.5,
            "preco_num": 8.0,
            "variacao_num": 0.0,
            "jogos_num": 1,
            "scout": {}
        })

        for pos_id in range(1, 6):
            names = sample_names[pos_id]
            qty = 2 if pos_id in (1, 2, 3) else 3
            for i in range(qty):
                atleta_id_counter += 1
                name = f"{names[(atleta_id_counter + i) % len(names)]}"
                status_id = 7 if (i == 0 or i == 1) else (2 if i == 2 else 5)
                atletas.append({
                    "atleta_id": atleta_id_counter,
                    "nome": name,
                    "apelido": name,
                    "foto": f"https://api.dicebear.com/7.x/avataaars/svg?seed={club['abreviacao']}_{name}",
                    "rodada_id": 1,
                    "clube_id": club["id"],
                    "posicao_id": pos_id,
                    "status_id": status_id,
                    "pontos_num": round(3.0 + (atleta_id_counter % 8) * 1.1, 2),
                    "media_num": round(4.0 + (atleta_id_counter % 5) * 0.8, 2),
                    "preco_num": round(6.0 + (atleta_id_counter % 12) * 1.1, 2),
                    "variacao_num": 0.2,
                    "jogos_num": 1,
                    "scout": {"G": 0, "A": 0, "DS": 1, "FS": 1}
                })

    return atletas

# 10 Jogos da Rodada (20 times)
PARTIDAS_RODADA_1 = [
    {
        "partida_id": 101,
        "clube_casa_id": 262, # Flamengo
        "clube_visitante_id": 266, # Fluminense (Clássico Fla-Flu)
        "partida_data": "2026-08-22 18:30:00",
        "local": "Maracanã, Rio de Janeiro",
        "placar_oficial_mandante": None,
        "placar_oficial_visitante": None,
        "aproveitamento_mandante": ["v", "v", "e", "v", "d"],
        "aproveitamento_visitante": ["v", "d", "v", "e", "v"]
    },
    {
        "partida_id": 102,
        "clube_casa_id": 275, # Palmeiras
        "clube_visitante_id": 264, # Corinthians (Derby)
        "partida_data": "2026-08-22 16:00:00",
        "local": "Allianz Parque, São Paulo",
        "placar_oficial_mandante": None,
        "placar_oficial_visitante": None,
        "aproveitamento_mandante": ["v", "v", "v", "d", "v"],
        "aproveitamento_visitante": ["d", "v", "e", "v", "e"]
    },
    {
        "partida_id": 103,
        "clube_casa_id": 276, # São Paulo
        "clube_visitante_id": 277, # Santos (San-São)
        "partida_data": "2026-08-22 21:00:00",
        "local": "MorumBIS, São Paulo",
        "placar_oficial_mandante": None,
        "placar_oficial_visitante": None,
        "aproveitamento_mandante": ["v", "e", "v", "d", "v"],
        "aproveitamento_visitante": ["v", "v", "d", "e", "d"]
    },
    {
        "partida_id": 104,
        "clube_casa_id": 282, # Atlético-MG
        "clube_visitante_id": 283, # Cruzeiro (Clássico Mineiro)
        "partida_data": "2026-08-23 16:00:00",
        "local": "Arena MRV, Belo Horizonte",
        "placar_oficial_mandante": None,
        "placar_oficial_visitante": None,
        "aproveitamento_mandante": ["v", "d", "v", "v", "e"],
        "aproveitamento_visitante": ["e", "v", "v", "d", "v"]
    },
    {
        "partida_id": 105,
        "clube_casa_id": 284, # Grêmio
        "clube_visitante_id": 285, # Internacional (Gre-Nal)
        "partida_data": "2026-08-23 18:30:00",
        "local": "Arena do Grêmio, Porto Alegre",
        "placar_oficial_mandante": None,
        "placar_oficial_visitante": None,
        "aproveitamento_mandante": ["d", "v", "e", "v", "v"],
        "aproveitamento_visitante": ["v", "v", "v", "e", "d"]
    },
    {
        "partida_id": 106,
        "clube_casa_id": 263, # Botafogo
        "clube_visitante_id": 267, # Vasco (Clássico da Amizade)
        "partida_data": "2026-08-23 20:30:00",
        "local": "Nilton Santos, Rio de Janeiro",
        "placar_oficial_mandante": None,
        "placar_oficial_visitante": None,
        "aproveitamento_mandante": ["v", "v", "v", "d", "v"],
        "aproveitamento_visitante": ["d", "e", "v", "v", "d"]
    },
    {
        "partida_id": 107,
        "clube_casa_id": 265, # Bahia
        "clube_visitante_id": 315, # Vitória (Ba-Vi)
        "partida_data": "2026-08-24 20:00:00",
        "local": "Arena Fonte Nova, Salvador",
        "placar_oficial_mandante": None,
        "placar_oficial_visitante": None,
        "aproveitamento_mandante": ["v", "d", "v", "e", "v"],
        "aproveitamento_visitante": ["d", "d", "e", "v", "e"]
    },
    {
        "partida_id": 108,
        "clube_casa_id": 356, # Fortaleza
        "clube_visitante_id": 327, # Ceará (Clássico-Rei)
        "partida_data": "2026-08-23 18:00:00",
        "local": "Arena Castelão, Fortaleza",
        "placar_oficial_mandante": None,
        "placar_oficial_visitante": None,
        "aproveitamento_mandante": ["v", "v", "e", "v", "v"],
        "aproveitamento_visitante": ["v", "e", "d", "v", "d"]
    },
    {
        "partida_id": 109,
        "clube_casa_id": 293, # Athletico-PR
        "clube_visitante_id": 294, # Coritiba (Atle-Tiba)
        "partida_data": "2026-08-23 16:00:00",
        "local": "Ligga Arena, Curitiba",
        "placar_oficial_mandante": None,
        "placar_oficial_visitante": None,
        "aproveitamento_mandante": ["v", "e", "v", "d", "v"],
        "aproveitamento_visitante": ["d", "v", "d", "e", "v"]
    },
    {
        "partida_id": 110,
        "clube_casa_id": 373, # Bragantino
        "clube_visitante_id": 354, # Juventude
        "partida_data": "2026-08-24 19:00:00",
        "local": "Nabi Abi Chedid, Bragança Paulista",
        "placar_oficial_mandante": None,
        "placar_oficial_visitante": None,
        "aproveitamento_mandante": ["e", "v", "d", "v", "e"],
        "aproveitamento_visitante": ["d", "d", "e", "v", "d"]
    }
]

# Status do Mercado
STATUS_MERCADO = {
    "rodada_atual": 1,
    "status_mercado": 1, # 1: Aberto, 2: Fechado
    "esquema_default_id": 3, # 4-3-3
    "aviso": "Mercado aberto para a 1ª Rodada do Cartola FC 2026! Confira as escalações prováveis antes do fechamento.",
    "fechamento": {
        "dia": 22,
        "mes": 8,
        "ano": 2026,
        "hora": "15:30",
        "timestamp": 1787423400
    },
    "game_over": False,
    "temporada": 2026,
    "times_escalados": 4829103
}

ESQUEMAS_TATICOS = [
    {
        "esquema_id": 1,
        "nome": "3-4-3",
        "posicoes": {"goleiro": 1, "zagueiro": 3, "lateral": 0, "meia": 4, "atacante": 3, "tecnico": 1}
    },
    {
        "esquema_id": 2,
        "nome": "3-5-2",
        "posicoes": {"goleiro": 1, "zagueiro": 3, "lateral": 0, "meia": 5, "atacante": 2, "tecnico": 1}
    },
    {
        "esquema_id": 3,
        "nome": "4-3-3",
        "posicoes": {"goleiro": 1, "zagueiro": 2, "lateral": 2, "meia": 3, "atacante": 3, "tecnico": 1}
    },
    {
        "esquema_id": 4,
        "nome": "4-4-2",
        "posicoes": {"goleiro": 1, "zagueiro": 2, "lateral": 2, "meia": 4, "atacante": 2, "tecnico": 1}
    },
    {
        "esquema_id": 5,
        "nome": "4-5-1",
        "posicoes": {"goleiro": 1, "zagueiro": 2, "lateral": 2, "meia": 5, "atacante": 1, "tecnico": 1}
    },
    {
        "esquema_id": 6,
        "nome": "5-3-2",
        "posicoes": {"goleiro": 1, "zagueiro": 3, "lateral": 2, "meia": 3, "atacante": 2, "tecnico": 1}
    },
    {
        "esquema_id": 7,
        "nome": "5-4-1",
        "posicoes": {"goleiro": 1, "zagueiro": 3, "lateral": 2, "meia": 4, "atacante": 1, "tecnico": 1}
    }
]

def main():
    atletas = scan_real_players()
    
    # Save files
    with open(os.path.join(DATA_DIR, "clubes.json"), "w", encoding="utf-8") as f:
        json.dump(CLUBS_RAW, f, ensure_ascii=False, indent=2)
    
    with open(os.path.join(DATA_DIR, "posicoes.json"), "w", encoding="utf-8") as f:
        json.dump(POSICOES, f, ensure_ascii=False, indent=2)
        
    with open(os.path.join(DATA_DIR, "status.json"), "w", encoding="utf-8") as f:
        json.dump(STATUS_LIST, f, ensure_ascii=False, indent=2)
        
    with open(os.path.join(DATA_DIR, "partidas.json"), "w", encoding="utf-8") as f:
        json.dump(PARTIDAS_RODADA_1, f, ensure_ascii=False, indent=2)
        
    with open(os.path.join(DATA_DIR, "mercado_status.json"), "w", encoding="utf-8") as f:
        json.dump(STATUS_MERCADO, f, ensure_ascii=False, indent=2)
        
    with open(os.path.join(DATA_DIR, "esquemas.json"), "w", encoding="utf-8") as f:
        json.dump(ESQUEMAS_TATICOS, f, ensure_ascii=False, indent=2)
        
    with open(os.path.join(DATA_DIR, "atletas.json"), "w", encoding="utf-8") as f:
        json.dump(atletas, f, ensure_ascii=False, indent=2)

    print(f"Data generation complete! {len(atletas)} athletes saved.")

if __name__ == "__main__":
    main()
