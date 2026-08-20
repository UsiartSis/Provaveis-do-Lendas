import os
import sys

# Adiciona o diretório raiz e o diretório server ao sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SERVER_DIR = os.path.join(BASE_DIR, "server")

if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)
if SERVER_DIR not in sys.path:
    sys.path.insert(0, SERVER_DIR)

from server.server import CartolaApiHandler

# Vercel Serverless Function entrypoint
class handler(CartolaApiHandler):
    pass
