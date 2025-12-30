import { LeadStatus } from '../types/index.js';
interface ProspectingSequence {
    id: string;
    name: string;
    description: string;
    steps: SequenceStep[];
    targetAudience?: string;
}
interface SequenceStep {
    order: number;
    delayHours: number;
    type: 'message' | 'media' | 'ai_generated';
    template?: string;
    mediaUrl?: string;
    aiPrompt?: string;
    condition?: StepCondition;
}
interface StepCondition {
    type: 'no_response' | 'has_response' | 'score_above' | 'score_below' | 'tag_present';
    value?: string | number;
}
interface AntiGhostingConfig {
    enabled: boolean;
    checkIntervalHours: number;
    maxAttempts: number;
    intervals: number[];
    messages: string[];
}
interface ProspectingConfig {
    enabled: boolean;
    maxDailyMessages: number;
    businessHoursStart: number;
    businessHoursEnd: number;
    timezone: string;
    antiGhosting: AntiGhostingConfig;
}
export declare class ProspectingAgent {
    private config;
    private sequences;
    private dailyMessageCount;
    private lastResetDate;
    constructor(config?: Partial<ProspectingConfig>);
    private loadDefaultSequences;
    registerSequence(sequence: ProspectingSequence): void;
    getSequence(id: string): ProspectingSequence | undefined;
    listSequences(): ProspectingSequence[];
    startSequence(phone: string, sequenceId: string): Promise<{
        success: boolean;
        message: string;
        sequenceRunId?: string;
    }>;
    private executeStep;
    private scheduleNextSteps;
    checkAndFollowUp(): Promise<{
        checked: number;
        followedUp: number;
    }>;
    private getFollowUpAttempts;
    qualifyLead(phone: string): Promise<{
        score: number;
        status: LeadStatus;
        interests: string[];
        recommendation: string;
    }>;
    sendBulkMessage(phones: string[], message: string, options?: {
        delayBetweenMs?: number;
        skipExisting?: boolean;
    }): Promise<{
        total: number;
        sent: number;
        failed: number;
        skipped: number;
    }>;
    private interpolateTemplate;
    private isWithinBusinessHours;
    private canSendMessage;
    private incrementMessageCount;
    private resetDailyCountIfNeeded;
    private sleep;
    getStats(): {
        enabled: boolean;
        dailyMessagesSent: number;
        dailyLimit: number;
        remainingToday: number;
        isWithinBusinessHours: boolean;
        registeredSequences: number;
    };
}
export declare const prospectingAgent: ProspectingAgent;
export {};
//# sourceMappingURL=prospecting.agent.d.ts.map