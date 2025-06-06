import { generateDailyContent, AIConfig } from '@/app/utils/ai';
import { createClient, SupabaseClient, PostgrestSingleResponse } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { DailyData } from '@/app/types/types';
import { ReviewContent, ContentItem } from '@/app/types/types'; // Keep imports needed for data structure

// Define a type for the structure fetched directly from the Supabase table
interface DailyContentFromDB {
    date: string;
    review_title: string | null;
    review_content: string | null;
    review_author: string | null;
    review_tag: string | null;
    review_source: string | null;
    concept_title: string | null;
    concept_content: string | null;
    question_title: string | null;
    question_content: string | null;
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

// Removed checkExistingContent function

export async function GET() {
  try {
    const today = new Date();
    const todayString = today.toISOString().split('T')[0]; // Format as YYYY-MM-DD

    console.log(`Attempting to check for content for date: ${todayString}`);

    // Check if today's content already exists
    const { data: existingContent, error: fetchError } = await supabase
      .from('daily_content')
      .select('*')
      .eq('date', todayString)
      .single();

    console.log("Check for today's content result:", { existingContent, fetchError });

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 means 'no rows found'
        console.error("Error checking for today's content:", fetchError);
        throw new Error(`Database fetch error: ${fetchError.message}`);
    }

    if (existingContent) {
      console.log("Today's content already exists in DB. Generation skipped.");
      return NextResponse.json({ message: "Today's content already exists.", date: todayString }, { status: 200 });
    } else {
      console.log("Today's content not found. Generating new content...");
      const aiConfig = validateAIConfig();

      // Generate all content types
      const generatedDailyData = await generateDailyContent(aiConfig);
      console.log("AI generated daily data successfully.", generatedDailyData);

      // Prepare data for insertion (without deduplication checks)
      const contentToInsert: Omit<DailyContentFromDB, 'id' | 'created_at'> = {
        date: todayString,
        review_title: generatedDailyData.today.review.title || null,
        review_content: generatedDailyData.today.review.content || null,
        review_author: (generatedDailyData.today.review as ReviewContent).author || null,
        review_tag: (generatedDailyData.today.review as ReviewContent).tag || null,
        review_source: (generatedDailyData.today.review as ReviewContent).source || null,
        concept_title: generatedDailyData.today.concept.title || null,
        concept_content: generatedDailyData.today.concept.content || null,
        question_title: generatedDailyData.today.question.title || null,
        question_content: generatedDailyData.today.question.content || null,
      };

      console.log("Attempting to insert content:", contentToInsert);

      const { data: insertedData, error: insertError } = await supabase
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