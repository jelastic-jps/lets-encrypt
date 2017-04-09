#!/usr/bin/env python

import SimpleHTTPServer
import SocketServer
import os

class myHandler(SimpleHTTPServer.SimpleHTTPRequestHandler):
   def do_GET(self):
       HOST =  self.headers["HOST"].split(":")[0]
       print HOST + self.path
       self.send_response(301)
       new_path = '%s%s%s'%('https://', HOST, self.path)
       self.send_header('Location', new_path)
       self.end_headers()

PORT = int(os.getenv("REDIRECT_SERVER_PORT", 7654))
handler = SocketServer.TCPServer(("", PORT), myHandler)
print 'serving at port', PORT
handler.serve_forever()
