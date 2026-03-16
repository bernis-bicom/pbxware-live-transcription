const clients = new Set<ReadableStreamDefaultController>();

export function addClient(controller: ReadableStreamDefaultController): void {
  clients.add(controller);
}

export function removeClient(
  controller: ReadableStreamDefaultController
): void {
  clients.delete(controller);
}

export function broadcast(msg: any): void {
  const data = `data: ${JSON.stringify(msg)}\n\n`;
  for (const client of clients) {
    try {
      client.enqueue(data);
    } catch {
      clients.delete(client);
    }
  }
}

export function broadcastSourceCount(count: number): void {
  const data = `data: ${JSON.stringify({ type: "sources", count })}\n\n`;
  for (const client of clients) {
    try {
      client.enqueue(data);
    } catch {
      clients.delete(client);
    }
  }
}

setInterval(() => {
  for (const client of clients) {
    try {
      client.enqueue(":\n\n");
    } catch {
      clients.delete(client);
    }
  }
}, 5000);
