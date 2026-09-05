const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:8001";

export const serverUrl = SERVER_URL;
export const socketUrl = SERVER_URL.replace(/^http/, "ws");
