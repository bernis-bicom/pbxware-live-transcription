export function dashboard(authEnabled: boolean): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>PBXware Live Transcription</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0d1117; color: #c9d1d9; }
    .header { padding: 20px 24px; border-bottom: 1px solid #21262d; display: flex; align-items: center; justify-content: space-between; }
    .header h1 { font-size: 18px; font-weight: 600; color: #f0f6fc; }
    .header-right { display: flex; align-items: center; gap: 16px; }
    .status { font-size: 13px; display: flex; align-items: center; gap: 8px; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: #3fb950; display: inline-block; }
    .dot.disconnected { background: #f85149; }
    .logout { font-size: 13px; color: #8b949e; text-decoration: none; padding: 4px 10px; border: 1px solid #30363d; border-radius: 6px; }
    .logout:hover { color: #c9d1d9; border-color: #8b949e; }
    .toolbar { padding: 12px 24px; border-bottom: 1px solid #21262d; display: flex; gap: 12px; align-items: center; }
    .toolbar button { background: #21262d; color: #c9d1d9; border: 1px solid #30363d; border-radius: 6px; padding: 6px 14px; cursor: pointer; font-size: 13px; }
    .toolbar button:hover { background: #30363d; }
    .toolbar .info { margin-left: auto; font-size: 13px; color: #8b949e; }
    .ws-sources { font-size: 12px; color: #8b949e; }
    .ws-sources .count { color: #3fb950; font-weight: 600; }
    .calls { padding: 16px 24px; overflow-y: auto; max-height: calc(100vh - 120px); }
    .call-group { background: #161b22; border: 1px solid #21262d; border-radius: 8px; margin-bottom: 12px; overflow: hidden; }
    .call-group.ended { opacity: 0.7; }
    .call-header { padding: 10px 14px; background: #1c2129; border-bottom: 1px solid #21262d; display: flex; align-items: center; gap: 12px; cursor: pointer; user-select: none; }
    .call-header:hover { background: #222a35; }
    .call-header .caller { font-weight: 600; color: #58a6ff; font-size: 14px; }
    .call-header .chevron { color: #484f58; font-size: 12px; transition: transform 0.2s; }
    .call-header .chevron.open { transform: rotate(90deg); }
    .call-header .badge-live { font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 4px; background: #1f3d2a; color: #3fb950; text-transform: uppercase; }
    .call-header .badge-ended { font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 4px; background: #21262d; color: #8b949e; text-transform: uppercase; }
    .call-header .msg-count { font-size: 11px; color: #484f58; }
    .call-header .time { margin-left: auto; font-size: 12px; color: #8b949e; }
    .messages { padding: 8px 14px; max-height: 400px; overflow-y: auto; }
    .messages.collapsed { display: none; }
    .msg { padding: 6px 0; display: flex; gap: 10px; border-bottom: 1px solid #21262d; animation: fadeIn 0.3s ease-out; }
    .msg:last-child { border-bottom: none; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
    .msg .speaker { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px; flex-shrink: 0; height: fit-content; margin-top: 2px; }
    .msg .speaker.left { background: #1f3d2a; color: #3fb950; }
    .msg .speaker.right { background: #0d2744; color: #58a6ff; }
    .msg .speaker.system { background: #3d2c00; color: #d29922; }
    .msg .text { font-size: 14px; line-height: 1.5; color: #e6edf3; }
    .msg .ts { font-size: 11px; color: #484f58; margin-left: auto; flex-shrink: 0; font-family: monospace; margin-top: 3px; }
    .empty { text-align: center; padding: 60px 24px; color: #484f58; }
    .empty p { margin-top: 8px; font-size: 14px; }
    .empty code { background: #21262d; padding: 2px 8px; border-radius: 4px; font-size: 13px; color: #8b949e; }
  </style>
</head>
<body>
  <div class="header">
    <h1>PBXware Live Transcription</h1>
    <div class="header-right">
      <div class="status"><span class="dot" id="dot"></span><span id="connStatus">Connecting...</span></div>
      ${authEnabled ? '<a class="logout" href="/logout">Logout</a>' : ""}
    </div>
  </div>
  <div class="toolbar">
    <button id="clearBtn">Clear</button>
    <div class="ws-sources">WebSocket sources: <span class="count" id="srcCount">0</span></div>
    <span class="info"><span id="msgCount">0</span> messages</span>
  </div>
  <div class="calls" id="calls">
    <div class="empty" id="emptyState">
      <p>Waiting for live transcription data...</p>
      <p style="margin-top:12px">Configure PBXware WebSocket Callback URL to:</p>
      <p style="margin-top:8px"><code id="wsUrl"></code></p>
    </div>
  </div>
  <script>
    const callsEl = document.getElementById('calls');
    const emptyState = document.getElementById('emptyState');
    const msgCountEl = document.getElementById('msgCount');
    const srcCountEl = document.getElementById('srcCount');
    const dotEl = document.getElementById('dot');
    const connEl = document.getElementById('connStatus');
    const callGroups = new Map();
    const pendingDeltas = new Map();
    let msgCount = 0;

    const wsProto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    document.getElementById('wsUrl').textContent = wsProto + '//' + location.host + '/ws';

    document.getElementById('clearBtn').addEventListener('click', () => {
      fetch('/history', { method: 'DELETE' }).then(() => {
        while (callsEl.firstChild) callsEl.removeChild(callsEl.firstChild);
        callsEl.appendChild(emptyState);
        emptyState.style.display = '';
        callGroups.clear();
        pendingDeltas.clear();
        msgCount = 0;
        msgCountEl.textContent = '0';
      });
    });

    function formatTime(iso) {
      if (!iso) return '';
      const d = new Date(iso);
      return d.toLocaleTimeString('en-GB', { hour12: false }) + '.' + String(d.getMilliseconds()).padStart(3, '0');
    }

    function el(tag, cls, text) {
      const e = document.createElement(tag);
      if (cls) e.className = cls;
      if (text !== undefined) e.textContent = text;
      return e;
    }

    function toggleCall(group) {
      group.expanded = !group.expanded;
      group.messagesEl.classList.toggle('collapsed', !group.expanded);
      group.chevronEl.classList.toggle('open', group.expanded);
    }

    function collapseOtherCalls(activeKey) {
      for (const [key, group] of callGroups) {
        if (key !== activeKey && group.expanded) {
          group.expanded = false;
          group.messagesEl.classList.add('collapsed');
          group.chevronEl.classList.remove('open');
        }
      }
    }

    function buildCallLabel(metadata) {
      if (!metadata) return '';
      const callerId = metadata.caller_id || '';
      const calleeId = metadata.callee_id || '';
      const calleeName = metadata.callee_name || '';
      const channelName = metadata.channel_name || '';
      if (!callerId && !calleeName) return '';
      let label = callerId;
      if (calleeId || calleeName) {
        label += ' \\u2192 ';
        label += calleeId ? calleeId : '';
        if (calleeName) label += calleeId ? ' (' + calleeName + ')' : calleeName;
      }
      if (channelName) label += ' \\u00B7 ' + channelName;
      return label;
    }

    function getCallGroup(callId, metadata) {
      const key = callId || 'default';
      if (callGroups.has(key)) {
        const existing = callGroups.get(key);
        if (metadata && !existing.hasMetadata) {
          const label = buildCallLabel(metadata);
          if (label) {
            existing.callerEl.textContent = label;
            existing.hasMetadata = true;
          }
        }
        return existing;
      }

      emptyState.style.display = 'none';
      collapseOtherCalls(null);

      const group = el('div', 'call-group');
      const hdr = el('div', 'call-header');

      const chevronEl = el('span', 'chevron open', '\\u25B6');
      hdr.appendChild(chevronEl);

      const label = buildCallLabel(metadata) || 'Call #' + key;
      const hasMetadata = !!(metadata && (metadata.caller_id || metadata.callee_name));

      const callerEl = el('span', 'caller', label);
      hdr.appendChild(callerEl);

      const statusEl = el('span', 'badge-live', 'live');
      hdr.appendChild(statusEl);

      const countEl = el('span', 'msg-count', '');
      hdr.appendChild(countEl);

      hdr.appendChild(el('span', 'time', formatTime(new Date().toISOString())));

      const messages = el('div', 'messages');
      group.appendChild(hdr);
      group.appendChild(messages);
      callsEl.insertBefore(group, callsEl.firstChild);

      const entry = {
        el: group, messagesEl: messages, callerEl, chevronEl, statusEl, countEl,
        hasMetadata, expanded: true, msgCount: 0
      };

      hdr.addEventListener('click', () => toggleCall(entry));
      callGroups.set(key, entry);
      return entry;
    }

    function speakerClass(speaker) {
      const s = (speaker || '').toLowerCase();
      if (s === 'caller') return 'left';
      if (s === 'callee') return 'right';
      return 'system';
    }

    function speakerLabel(speaker) {
      const s = (speaker || '').toLowerCase();
      if (s === 'caller') return 'Caller';
      if (s === 'callee') return 'Callee';
      return speaker || 'System';
    }

    function processMessage(raw) {
      const callId = raw._callId || 'default';

      if (raw._event === 'call_ended') {
        const group = callGroups.get(callId);
        if (group) {
          group.statusEl.className = 'badge-ended';
          group.statusEl.textContent = 'ended';
          group.el.classList.add('ended');
        }
        return;
      }

      const td = raw.transcribed_data || raw;
      const type = td.type || '';
      const itemId = td.item_id || '';
      const speaker = td.speaker || '';
      const receivedAt = raw.received_at || '';

      if (type.includes('.delta')) {
        const key = callId + ':' + itemId + ':' + speaker;
        const prev = pendingDeltas.get(key);
        if (prev) {
          prev.textEl.textContent = (prev.text || '') + (td.delta || '');
          prev.text += (td.delta || '');
        } else {
          const group = getCallGroup(callId, raw.metadata);
          const div = el('div', 'msg');
          div.appendChild(el('span', 'speaker ' + speakerClass(speaker), speakerLabel(speaker)));
          const textEl = el('span', 'text', td.delta || '');
          div.appendChild(textEl);
          div.appendChild(el('span', 'ts', formatTime(receivedAt)));
          group.messagesEl.appendChild(div);
          group.messagesEl.scrollTop = group.messagesEl.scrollHeight;
          pendingDeltas.set(key, { div: div, textEl: textEl, text: td.delta || '' });
        }
        return;
      }

      if (type.includes('.completed')) {
        const transcript = td.transcript || '';
        if (!transcript) return;

        msgCount++;
        msgCountEl.textContent = String(msgCount);

        const group = getCallGroup(callId, raw.metadata);
        group.msgCount++;
        group.countEl.textContent = group.msgCount + ' msg' + (group.msgCount !== 1 ? 's' : '');

        const key = callId + ':' + itemId + ':' + speaker;
        const pending = pendingDeltas.get(key);

        if (pending) {
          pending.textEl.textContent = transcript;
          pendingDeltas.delete(key);
        } else {
          const div = el('div', 'msg');
          div.appendChild(el('span', 'speaker ' + speakerClass(speaker), speakerLabel(speaker)));
          div.appendChild(el('span', 'text', transcript));
          div.appendChild(el('span', 'ts', formatTime(receivedAt)));
          group.messagesEl.appendChild(div);
          group.messagesEl.scrollTop = group.messagesEl.scrollHeight;
        }
        return;
      }

      if (!raw._event) {
        msgCount++;
        msgCountEl.textContent = String(msgCount);
        const group = getCallGroup(callId, raw.metadata);
        const div = el('div', 'msg');
        div.appendChild(el('span', 'speaker system', 'System'));
        div.appendChild(el('span', 'text', JSON.stringify(raw)));
        div.appendChild(el('span', 'ts', formatTime(receivedAt)));
        group.messagesEl.appendChild(div);
      }
    }

    function connectSSE() {
      const es = new EventSource('/stream');
      es.onopen = () => { dotEl.className = 'dot'; connEl.textContent = 'Live'; };
      es.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'sources') { srcCountEl.textContent = String(msg.count); return; }
          processMessage(msg);
        } catch {}
      };
      es.onerror = () => { dotEl.className = 'dot disconnected'; connEl.textContent = 'Reconnecting...'; };
    }

    fetch('/history').then(r => r.json()).then(data => {
      (data.messages || []).forEach(m => processMessage(m));
    });
    connectSSE();
  </script>
</body>
</html>`;
}
