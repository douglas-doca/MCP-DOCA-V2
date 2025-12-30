export declare function reloadPrompt(): void;
export declare class ResponseAgent {
    config: any;
    constructor(config: any);
    processMessage(phone: string, chatId: string, userMessage: string): Promise<any>;
    generateResponse(conversation: any, userMessage: string, emotionData: any): Promise<string>;
    buildSystemPrompt(conversation: any, emotionData: any, userMessage: string): Promise<string>;
    checkEscalation(message: string): {
        shouldEscalate: boolean;
        reason?: string;
    };
    getEscalationResponse(reason: string): string;
    setSystemPrompt(prompt: string): void;
    setBusinessInfo(info: string): void;
}
export declare const responseAgent: ResponseAgent;
//# sourceMappingURL=response.agent.d.ts.map