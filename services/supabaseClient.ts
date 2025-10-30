import { createClient, SupabaseClient } from '@supabase/supabase-js';

// 認証情報をこのファイルに直接定義
const SUPABASE_URL = 'https://rwjhpfghhgstvplmggks.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3amhwZmdoaGdzdHZwbG1nZ2tzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MDgzNDYsImV4cCI6MjA3NDI4NDM0Nn0.RfCRooN6YVTHJ2Mw-xFCWus3wUVMLkJCLSitB8TNiIo';

// Supabaseクライアントを一度だけ初期化してエクスポート
export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true, // Essential for OAuth callback
        flowType: 'pkce',         // Recommended for OAuth
    },
});

// 既存コードとの互換性のためにgetSupabaseもエクスポート
export const getSupabase = (): SupabaseClient => {
    if (!supabase) {
        throw new Error("Supabase client is not initialized. Please configure credentials in services/supabaseClient.ts");
    }
    return supabase;
};

// 接続情報が設定されているか確認する関数
export const hasSupabaseCredentials = (): boolean => {
    const isUrlPlaceholder = SUPABASE_URL.includes('ここにURLを貼り付け');
    const isKeyPlaceholder = SUPABASE_KEY.includes('ここにキーを貼り付け');
    return !!(SUPABASE_URL && SUPABASE_KEY && !isUrlPlaceholder && !isKeyPlaceholder);
};