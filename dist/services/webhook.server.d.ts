interface WebhookConfig {
    port: number;
    host: string;
    secret?: string;
    autoReply: boolean;
    typingDelay: boolean;
    typingDelayMs: number;
    ignoreSelf: boolean;
    ignoreGroups: boolean;
    allowedNumbers?: string[];
    blockedNumbers?: string[];
    staticDir: string;
}
export declare class WebhookServer {
    private server;
    private config;
    private routes;
    private processingQueue;
    constructor(config?: Partial<WebhookConfig>);
    private setupRoutes;
    private addRoute;
    private serveStaticFile;
    private handleAPIConversations;
    private handleAPILeads;
    private handleAPIMessages;
    private handleAPIStats;
    private handleAPIDashboardMetrics;
    private handleAPISentimentMatrix;
    private handleAPIEmotionalFunnel;
    private handleAPILeadHealth;
    private handleAPIGetSettings;
    private handleAPISaveSettings;
    private handleAPIGetKnowledge;
    private handleAPISaveKnowledge;
    private handleAPIDeleteKnowledge;
    private handleWAHAWebhook;
    private handleHealth;
    private handleStats;
    private handleSendMessage;
    private handleGetConversation;
    private processMessage;
    private isBlocked;
    private isAllowed;
    start(): Promise<void>;
    stop(): Promise<void>;
    private sendJSON;
    private sleep;
    updateConfig(updates: Partial<WebhookConfig>): void;
    getConfig(): WebhookConfig;
}
export declare const webhookServer: WebhookServer;
export {};
//# sourceMappingURL=webhook.server.d.ts.map