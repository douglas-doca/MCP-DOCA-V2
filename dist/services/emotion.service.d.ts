import { EmotionEvent, HealthMetrics } from '../types/emotion.types.js';
export declare class EmotionService {
    saveEmotionEvent(event: Omit<EmotionEvent, 'id' | 'detected_at'>): Promise<void>;
    updateLeadMetrics(leadId: string): Promise<void>;
    private calculateEmotionProfile;
    private calculateHealthMetrics;
    getDashboardMetrics(): Promise<any>;
    getSentimentMatrix(): Promise<any>;
    getEmotionalFunnel(): Promise<any>;
    getLeadHealth(leadId: string): Promise<HealthMetrics | null>;
    private emotionToSentiment;
}
export declare const emotionService: EmotionService;
//# sourceMappingURL=emotion.service.d.ts.map