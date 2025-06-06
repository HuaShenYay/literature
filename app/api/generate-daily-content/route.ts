import { generateDailyContent, AIConfig } from '@/app/utils/ai';
import { createClient, SupabaseClient, PostgrestSingleResponse } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { DailyData } from '@/app/types/types';

// Define a type for the structure fetched directly from the Supabase table
interface DailyContentRow {
    id: number;
    created_at: string;
    date: string;
    review_title: string;
    review_content: string;
    review_author: string | null;
    review_tag: string | null;
    review_source: string | null;
    concept_title: string;
    concept_content: string;
    question_title: string;
    question_content: string;
}

// Initialize Supabase client (using Service Role Key for backend operations)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("Missing Supabase URL or Service Role Key in environment variables.");
  throw new Error("Server configuration error: Database credentials are not set.");
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey);

// Helper function to validate required environment variables for AI
function validateAIConfig(): AIConfig {
  const apiKey = process.env.SILICONFLOW_API_KEY;
  const modelId = process.env.SILICONFLOW_MODEL_ID;

  if (!apiKey || !modelId) {
    console.error("Missing SiliconFlow API Key or Model ID in environment variables.");
    throw new Error("Server configuration error: AI API credentials are not set.");
  }

  return { apiKey, modelId };
}

export async function GET() {
  try {
    const today = new Date();
    const todayString = today.toISOString().split('T')[0]; // Format as YYYY-MM-DD

    console.log(`Attempting to check for content for date: ${todayString}`);

    // Check if today's content already exists
    const { data: todayData, error: fetchTodayError }: PostgrestSingleResponse<DailyContentRow> = await supabase
      .from('daily_content')
      .select('*')
      .eq('date', todayString)
      .single();

    console.log("Check for today's content result:", { todayData, fetchTodayError });

    if (fetchTodayError && fetchTodayError.code !== 'PGRST116') { // PGRST116 means 'no rows found'
        console.error("Error checking for today's content:", fetchTodayError);
        throw new Error(`Database fetch error: ${fetchTodayError.message}`);
    }

    if (todayData) {
      console.log("Today's content already exists in DB. Generation skipped.");
      return NextResponse.json({ message: "Today's content already exists.", date: todayString }, { status: 200 });
    } else {
      console.log("Today's content not found. Generating new content...");
      const aiConfig = validateAIConfig();
      const generatedContent: DailyData = await generateDailyContent(aiConfig);
      console.log("AI generated content successfully.");

      const contentToInsert: Omit<DailyContentRow, 'id' | 'created_at'> = {
        date: todayString,
        review_title: generatedContent.today.review.title,
        review_content: generatedContent.today.review.content,
        review_author: generatedContent.today.review.author || null,
        review_tag: generatedContent.today.review.tag || null,
        review_source: generatedContent.today.review.source || null,
        concept_title: generatedContent.today.concept.title,
        concept_content: generatedContent.today.concept.content,
        question_title: generatedContent.today.question.title,
        question_content: generatedContent.today.question.content,
      };

      console.log("Attempting to insert content:", contentToInsert);

      const { data: insertedData, error: insertError }: PostgrestSingleResponse<null> = await supabase
        .from('daily_content')
        .insert([contentToInsert]);

      console.log("Insert result:", { insertedData, insertError });

      if (insertError) {
        console.error("Error inserting today's content:", insertError);
        throw new Error(`Database insert error: ${insertError.message}`);
      } else {
          console.log(`Successfully inserted content for date ${todayString} into DB.`);
          return NextResponse.json({ message: "Successfully generated and inserted today's content.", date: todayString }, { status: 201 });
      }
    }
  } catch (error: unknown) {
    console.error("Error in generate-daily-content API route:", error);
    let errorMessage = "An unexpected error occurred during content generation.";
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'object' && error !== null) {
      const potentialErrorObj = error as { message?: unknown };
      if (typeof potentialErrorObj.message === 'string') {
        errorMessage = potentialErrorObj.message;
      }
    }

    return new NextResponse(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
} 