// literaure/app/types/types.ts

// Define types for the content structure
export interface ContentItem {
    title: string;
    content: string;
}

export interface ReviewContent extends ContentItem {
    author?: string; // Optional fields
    tag?: string;
    source?: string;
}

export interface DailyContent {
    date: string;
    review: ReviewContent;
    concept: ContentItem;
    question: ContentItem;
}

export interface DailyData {
    today: DailyContent;
    yesterday: DailyContent;
}

export type ActiveSection = 'review' | 'concept' | 'question';

// Define AI configuration type
export interface AIConfig {
    apiKey: string;
    modelId: string;
} 