import json
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")

def rank_standings_table(tabela_list):
    """
    Ordena a tabela de classificação segundo critérios oficiais da CBF e Sofascore:
    1. Pontos (desc)
    2. Vitórias (desc)
    3. Saldo de Gols (desc)
    4. Gols Pró (desc)
    """
    def ranking_key(item):
        return (
            int(item.get("pontos", 0)),
            int(item.get("vitorias", 0)),
            int(item.get("saldo_gols", 0)),
            int(item.get("gols_pro", 0))
        )

    tabela_list.sort(key=ranking_key, reverse=True)

    # Atribuir posições e zonas
    for idx, item in enumerate(tabela_list):
        pos = idx + 1
        item["posicao"] = pos
        if pos <= 4:
            item["zona"] = "libertadores"
        elif pos == 5:
            item["zona"] = "pre_libertadores"
        elif pos <= 12:
            item["zona"] = "sulamericana"
        elif pos >= 17:
            item["zona"] = "rebaixamento"
        else:
            item["zona"] = "neutra"

    return tabela_list


def recalculate_standings_from_matches(active_matches=None, clubes_list=None):
    """
    Recalcula toda a tabela de classificação oficial considerando:
    1. Todas as partidas oficiais anteriores da temporada (R1 a R22 de todas_partidas_temporada.json)
    2. As partidas da rodada atual com placar oficial (de partidas.json ou active_matches)
    Isso NUNCA zera a tabela e sempre preserva 100% da realidade matemática do campeonato.
    """
    if clubes_list is None:
        clubes_path = os.path.join(DATA_DIR, "clubes.json")
        if os.path.exists(clubes_path):
            with open(clubes_path, "r", encoding="utf-8") as f:
                clubes_list = json.load(f)
        else:
            clubes_list = []

    if isinstance(clubes_list, dict):
        clubes_list = list(clubes_list.values())

    clubes_map = {c["id"]: c for c in clubes_list}

    # Carregar todas as 220 partidas oficiais da temporada
    all_matches = []
    season_path = os.path.join(DATA_DIR, "todas_partidas_temporada.json")
    if os.path.exists(season_path):
        try:
            with open(season_path, "r", encoding="utf-8") as f:
                all_matches = json.load(f)
        except Exception:
            all_matches = []

    # Adicionar / atualizar partidas da rodada ativa
    if active_matches is None:
        partidas_path = os.path.join(DATA_DIR, "partidas.json")
        if os.path.exists(partidas_path):
            try:
                with open(partidas_path, "r", encoding="utf-8") as f:
                    active_matches = json.load(f)
            except Exception:
                active_matches = []

    if active_matches and isinstance(active_matches, list):
        active_ids = {m.get("partida_id") for m in active_matches if m.get("partida_id")}
        # Filtrar partidas da lista geral se já estão nas ativas para evitar duplicidade
        all_matches = [m for m in all_matches if m.get("partida_id") not in active_ids]
        all_matches.extend(active_matches)

    # Inicializar estatísticas para os 20 clubes
    stats = {}
    for cid, club in clubes_map.items():
        stats[cid] = {
            "clube_id": cid,
            "nome": club.get("nome", "Clube"),
            "abreviacao": club.get("abreviacao", "CLU"),
            "escudo": club.get("escudo", ""),
            "jogos": 0,
            "vitorias": 0,
            "empates": 0,
            "derrotas": 0,
            "gols_pro": 0,
            "gols_contra": 0,
            "saldo_gols": 0,
            "pontos": 0,
            "aproveitamento": 0.0,
            "historico_jogos": [],
            "stats_casa": {
                "jogos": 0,
                "vitorias": 0,
                "empates": 0,
                "derrotas": 0,
                "gols_pro": 0,
                "gols_contra": 0,
                "saldo_gols": 0,
                "pontos": 0
            },
            "stats_fora": {
                "jogos": 0,
                "vitorias": 0,
                "empates": 0,
                "derrotas": 0,
                "gols_pro": 0,
                "gols_contra": 0,
                "saldo_gols": 0,
                "pontos": 0
            }
        }

    # Ordenar cronologicamente
    sorted_matches = sorted(
        all_matches,
        key=lambda m: (m.get("rodada", 0), m.get("partida_data", ""))
    )

    for m in sorted_matches:
        pm = m.get("placar_oficial_mandante")
        pv = m.get("placar_oficial_visitante")

        if pm is None or pv is None:
            continue

        cid_casa = m.get("clube_casa_id")
        cid_fora = m.get("clube_visitante_id")

        if cid_casa not in stats or cid_fora not in stats:
            continue

        try:
            pm = int(pm)
            pv = int(pv)
        except Exception:
            continue

        st_casa = stats[cid_casa]
        st_casa["jogos"] += 1
        st_casa["gols_pro"] += pm
        st_casa["gols_contra"] += pv
        st_casa["saldo_gols"] += (pm - pv)

        st_casa["stats_casa"]["jogos"] += 1
        st_casa["stats_casa"]["gols_pro"] += pm
        st_casa["stats_casa"]["gols_contra"] += pv
        st_casa["stats_casa"]["saldo_gols"] += (pm - pv)

        st_fora = stats[cid_fora]
        st_fora["jogos"] += 1
        st_fora["gols_pro"] += pv
        st_fora["gols_contra"] += pm
        st_fora["saldo_gols"] += (pv - pm)

        st_fora["stats_fora"]["jogos"] += 1
        st_fora["stats_fora"]["gols_pro"] += pv
        st_fora["stats_fora"]["gols_contra"] += pm
        st_fora["stats_fora"]["saldo_gols"] += (pv - pm)

        if pm > pv:
            st_casa["vitorias"] += 1
            st_casa["pontos"] += 3
            st_casa["historico_jogos"].append("W")
            st_casa["stats_casa"]["vitorias"] += 1
            st_casa["stats_casa"]["pontos"] += 3

            st_fora["derrotas"] += 1
            st_fora["historico_jogos"].append("L")
            st_fora["stats_fora"]["derrotas"] += 1
        elif pv > pm:
            st_fora["vitorias"] += 1
            st_fora["pontos"] += 3
            st_fora["historico_jogos"].append("W")
            st_fora["stats_fora"]["vitorias"] += 1
            st_fora["stats_fora"]["pontos"] += 3

            st_casa["derrotas"] += 1
            st_casa["historico_jogos"].append("L")
            st_casa["stats_casa"]["derrotas"] += 1
        else:
            st_casa["empates"] += 1
            st_casa["pontos"] += 1
            st_casa["historico_jogos"].append("D")
            st_casa["stats_casa"]["empates"] += 1
            st_casa["stats_casa"]["pontos"] += 1

            st_fora["empates"] += 1
            st_fora["pontos"] += 1
            st_fora["historico_jogos"].append("D")
            st_fora["stats_fora"]["empates"] += 1
            st_fora["stats_fora"]["pontos"] += 1

    tabela_list = []
    for cid, st in stats.items():
        jogos = st["jogos"]
        pontos = st["pontos"]
        max_pts = (jogos * 3) if jogos > 0 else 1
        st["aproveitamento"] = round((pontos / max_pts) * 100, 1) if jogos > 0 else 0.0
        
        ultimos_5 = st["historico_jogos"][-5:] if len(st["historico_jogos"]) >= 5 else (st["historico_jogos"] or ["D"])
        st["ultimos_5"] = ultimos_5
        del st["historico_jogos"]
        tabela_list.append(st)

    ranked = rank_standings_table(tabela_list)

    return {
        "temporada": 2026,
        "competicao": "Brasileirão Série A 2026",
        "total_clubes": len(ranked),
        "tabela": ranked
    }
