// FIX: Import LiveServerMessage and Blob for Live Chat functionality.
import { GoogleGenAI, Type, GenerateContentResponse, Chat, Modality, FunctionDeclaration, LiveServerMessage, Blob } from "@google/genai";
// FIX: Import MarketResearchReport type.
import { AISuggestions, Customer, CompanyAnalysis, InvoiceData, AIJournalSuggestion, User, ApplicationCode, Estimate, EstimateItem, Lead, ApprovalRoute, Job, LeadStatus, JournalEntry, LeadScore, Application, ApplicationWithDetails, CompanyInvestigation, CustomProposalContent, LeadProposalPackage, MarketResearchReport, EstimateDraft, ExtractedParty, GeneratedEmailContent, EstimateLineItem, UUID, Project, AllocationDivision, AccountItem } from '../types.ts';
import { formatJPY, createSignature } from "../utils.ts";
import { v4 as uuidv4 } from 'uuid';

// AI機能をグローバルに制御する環境変数
const NEXT_PUBLIC_AI_OFF = process.env.NEXT_PUBLIC_AI_OFF === '1';

const API_KEY = process.env.API_KEY;

if (!API_KEY && !NEXT_PUBLIC_AI_OFF) {
  console.error("API_KEY environment variable not set. AI functions might be unavailable.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY! });

const model = "gemini-2.5-flash-lite"; // Default model for low-latency

const checkOnlineAndAIOff = () => {
    if (NEXT_PUBLIC_AI_OFF) {
        throw new Error('AI機能は現在無効です。');
    }
    if (!navigator.onLine) {
        throw new Error('オフラインです。ネットワーク接続を確認してください。');
    }
}

async function withRetry<T>(fn: (signal?: AbortSignal) => Promise<T>, retries = 2, delay = 500): Promise<T> {
    const controller = new AbortController();
    const signal = controller.signal;

    try {
        return await fn(signal);
    } catch (error: any) {
        if (error.name === 'AbortError') {
            throw error; // Propagate AbortError directly
        }
        if (retries > 0) {
            console.warn(`AI API call failed, retrying (${retries} retries left):`, error);
            await new Promise(res => setTimeout(res, delay));
            controller.abort(); // Abort previous attempt
            return withRetry(fn, retries - 1, delay * 2); // Exponential backoff
        }
        throw error;
    }
}

const suggestJobSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "印刷案件の簡潔でプロフェッショナルなタイトル。例：「カフェオープン記念 A5チラシ」" },
    quantity: { type: Type.INTEGER, description: "この種の案件で一般的または推奨される数量。例：1000" },
    paperType: { type: Type.STRING, description: "提供されたリストから最も適した用紙を選択。" },
    finishing: { type: Type.STRING, description: "提供されたリストから推奨される加工オプションを選択。" },
    details: { type: Type.STRING, description: "色、両面/片面、目的など、仕様を含む案件要件の詳細な説明。" },
    price: { type: Type.INTEGER, description: "この案件の現実的な販売価格（P）。数量、用紙、加工を考慮して見積もってください。例：85000" },
    variableCost: { type: Type.INTEGER, description: "この案件の現実的な変動費（V）。主に用紙代やインク代など。一般的に価格の40-60%程度です。例：35000" },
  },
  required: ["title", "quantity", "paperType", "finishing", "details", "price", "variableCost"],
};

export const suggestJobParameters = async (prompt: string, paperTypes: string[], finishingOptions: string[]): Promise<AISuggestions> => {
  checkOnlineAndAIOff();
  return withRetry(async (signal) => {
    const fullPrompt = `以下の依頼内容に基づき、印刷案件のパラメータを提案してください。
依頼内容: "${prompt}"

選択可能な用紙リスト: ${paperTypes.join(', ')}
選択可能な加工リスト: ${finishingOptions.join(', ')}

上記リストに最適なものがない場合は、依頼内容に最も近い一般的なものを提案してください。`;
    const response = await ai.models.generateContent({
      model,
      contents: fullPrompt,
      config: { responseMimeType: "application/json", responseSchema: suggestJobSchema, signal },
    });
    let jsonStr = response.text.trim();
    if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.substring(7, jsonStr.length - 3).trim();
    }
    return JSON.parse(jsonStr);
  });
};

export const analyzeCompany = async (customer: Customer): Promise<CompanyAnalysis> => {
    checkOnlineAndAIOff();
    return withRetry(async (signal) => {
        const prompt = `以下の企業情報に基づいて、詳細な企業分析レポートをJSON形式で作成してください。Web検索も活用し、最新の情報を反映させてください。

企業名: ${customer.customerName}
ウェブサイト: ${customer.websiteUrl || '情報なし'}
事業内容: ${customer.companyContent || '情報なし'}
既存の営業活動情報: ${customer.infoSalesActivity || '情報なし'}
要求事項: ${customer.infoRequirements || '情報なし'}

JSONのフォーマットは以下のようにしてください:
{
  "swot": "企業の強み、弱み、機会、脅威を分析したSWOT分析の結果。箇条書きで記述。",
  "painPointsAndNeeds": "企業が抱えているであろう課題や潜在的なニーズ。箇条書きで記述。",
  "suggestedActions": "これらの分析に基づき、当社が提案できる具体的なアクションや印刷案件。箇条書きで記述。",
  "proposalEmail": {
    "subject": "提案メールの件名",
    "body": "提案メールの本文。担当者名は[あなたの名前]としてください。"
  }
}
`;
        const response = await ai.models.generateContent({
            model: "gemini-2.5-pro", // Use pro model for complex analysis
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
                signal,
                thinkingConfig: { thinkingBudget: 32768 }, // Max thinking budget for complex queries
            },
        });
        
        let jsonStr = response.text.trim();
        if (jsonStr.startsWith('```json')) {
            jsonStr = jsonStr.substring(7, jsonStr.length - 3).trim();
        }

        try {
            const result = JSON.parse(jsonStr);
            const rawChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
            const sources = rawChunks.map((chunk: any) => chunk.web).filter(Boolean).map((webChunk: any) => ({ uri: webChunk.uri, title: webChunk.title }));
            const uniqueSources = Array.from(new Map(sources.map(item => [item.uri, item])).values());
            
            return { ...result, sources: uniqueSources };
        } catch (e) {
            console.error("Failed to parse JSON from Gemini:", e);
            // Fallback: return the text as part of the analysis.
            return {
                 swot: "JSON解析エラー",
                 painPointsAndNeeds: jsonStr,
                 suggestedActions: "",
                 proposalEmail: { subject: "エラー", body: "AIからの応答を解析できませんでした。" }
            };
        }
    });
};

export const investigateLeadCompany = async (companyName: string): Promise<CompanyInvestigation> => {
    checkOnlineAndAIOff();
    return withRetry(async (signal) => {
        const prompt = `企業名「${companyName}」について、その事業内容、最近のニュース、市場での評判を調査し、簡潔にまとめてください。`;
        const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
                signal
            },
        });

        const summary = response.text;
        const rawChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        
        // FIX: Use a more robust type guard to ensure `sources` is correctly typed.
        const sources: { uri: string; title: string; }[] = (rawChunks || [])
            .map((chunk: any) => chunk.web)
            .filter((web: any): web is { uri: string; title: string } => 
                Boolean(web && typeof web.uri === 'string' && typeof web.title === 'string')
            );

        const uniqueSources = Array.from(new Map(sources.map(item => [item.uri, item])).values());
        
        return { summary, sources: uniqueSources };
    });
};

export const enrichCustomerData = async (customerName: string): Promise<Partial<Customer>> => {
    checkOnlineAndAIOff();
    return withRetry(async (signal) => {
        const prompt = `企業名「${customerName}」について、Web検索を用いて以下の情報を調査し、必ずJSON形式で返してください。見つからない情報はnullとしてください。
- 公式ウェブサイトURL (websiteUrl)
- 事業内容 (companyContent)
- 年商 (annualSales)
- 従業員数 (employeesCount)
- 本社の住所 (address1)
- 代表電話番号 (phoneNumber)
- 代表者名 (representative)`;
        const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
                signal
            },
        });
        
        let jsonStr = response.text.trim();
        if (jsonStr.startsWith('```json')) {
            jsonStr = jsonStr.substring(7, jsonStr.length - 3).trim();
        }
        
        const parsed = JSON.parse(jsonStr);
        
        const cleanedData: Partial<Customer> = {};
        for (const key in parsed) {
            if (parsed[key] !== null && parsed[key] !== undefined) {
                cleanedData[key as keyof Customer] = parsed[key];
            }
        }
        return cleanedData;
    });
};


const extractInvoiceSchema = {
    type: Type.OBJECT,
    properties: {
        vendorName: { type: Type.STRING, description: "請求書の発行元企業名。" },
        invoiceDate: { type: Type.STRING, description: "請求書の発行日 (YYYY-MM-DD形式)。" },
        totalAmount: { type: Type.NUMBER, description: "請求書の合計金額（税込）。" },
        description: { type: Type.STRING, description: "請求内容の簡潔な説明。" },
        costType: { type: Type.STRING, description: "この費用が変動費(V)か固定費(F)かを推測してください。", enum: ["V", "F"] },
        account: { type: Type.STRING, description: "この請求内容に最も適した会計勘定科目を提案してください。" },
        allocationDivision: { type: Type.STRING, description: "この費用に最も適した振分区分を提案してください。" },
        relatedCustomer: { type: Type.STRING, description: "この費用に関連する顧客名（もしあれば）。" },
        project: { type: Type.STRING, description: "この費用に関連する案件名やプロジェクト名（もしあれば）。" }
    },
    required: ["vendorName", "invoiceDate", "totalAmount", "description", "costType", "account"],
};

export const extractInvoiceDetails = async (imageBase64: string, mimeType: string, accountItems: AccountItem[], allocationDivisions: AllocationDivision[]): Promise<InvoiceData> => {
    checkOnlineAndAIOff();
    return withRetry(async (signal) => {
        const imagePart = { inlineData: { data: imageBase64, mimeType } };
        const textPart = { text: `この画像から請求書の詳細情報を抽出してください。
勘定科目は次のリストから選択してください: ${accountItems.map(i => i.name).join(', ')}
振分区分は次のリストから選択してください: ${allocationDivisions.map(d => d.name).join(', ')}` };
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [imagePart, textPart] },
            config: { responseMimeType: "application/json", responseSchema: extractInvoiceSchema, signal }
        });
        let jsonStr = response.text.trim();
        if (jsonStr.startsWith('```json')) {
            jsonStr = jsonStr.substring(7, jsonStr.length - 3).trim();
        }
        return JSON.parse(jsonStr);
    });
};

const suggestJournalEntrySchema = {
    type: Type.OBJECT,
    properties: {
        account: { type: Type.STRING, description: "この取引に最も適した勘定科目。" },
        description: { type: Type.STRING, description: "取引内容を簡潔に説明する摘要。" },
        debit: { type: Type.NUMBER, description: "借方の金額。貸方の場合は0。" },
        credit: { type: Type.NUMBER, description: "貸方の金額。借方の場合は0。" }
    },
    required: ["account", "description", "debit", "credit"]
};

export const suggestJournalEntry = async (prompt: string): Promise<AIJournalSuggestion> => {
  checkOnlineAndAIOff();
  return withRetry(async (signal) => {
    const fullPrompt = `以下の日常的な取引内容を会計仕訳に変換してください。「${prompt}」`;
    const response = await ai.models.generateContent({
      model,
      contents: fullPrompt,
      config: { responseMimeType: "application/json", responseSchema: suggestJournalEntrySchema, signal },
    });
    let jsonStr = response.text.trim();
    if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.substring(7, jsonStr.length - 3).trim();
    }
    return JSON.parse(jsonStr);
  });
};

export const generateSalesEmail = async (customer: Customer, senderName: string): Promise<{ subject: string; body: string }> => {
    checkOnlineAndAIOff();
    return withRetry(async (signal) => {
        const prompt = `顧客名「${customer.customerName}」向けの営業提案メールを作成してください。送信者は「${senderName}」です。`;
        const response = await ai.models.generateContent({ model, contents: prompt, config: { signal } });
        const text = response.text;
        const subjectMatch = text.match(/件名:\s*(.*)/);
        const bodyMatch = text.match(/本文:\s*([\s\S]*)/);
        return {
            subject: subjectMatch ? subjectMatch[1].trim() : 'ご提案の件',
            body: bodyMatch ? bodyMatch[1].trim() : text,
        };
    });
};

export const generateLeadReplyEmail = async (lead: Lead): Promise<GeneratedEmailContent> => { // FIX: Changed return type to GeneratedEmailContent
    checkOnlineAndAIOff();
    return withRetry(async (signal) => {
        const prompt = `以下のリード情報に対して、初回の返信メールを作成してください。
会社名: ${lead.company}
担当者名: ${lead.name}様
問い合わせ内容: ${lead.message || '記載なし'}
件名と本文を分離して生成してください。

出力JSONフォーマット:
{
  "subject": "提案メールの件名",
  "bodyText": "提案メールの本文。担当者名は[あなたの名前]としてください。"
}`;
        const response = await ai.models.generateContent({ 
            model, 
            contents: prompt, 
            config: { 
                signal,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        subject: { type: Type.STRING },
                        bodyText: { type: Type.STRING },
                    },
                    required: ["subject", "bodyText"],
                },
            },
        });
        const jsonStr = response.text.trim().replace(/^```json\n|\n```$/g, ''); // Clean JSON block
        return JSON.parse(jsonStr); // FIX: Ensure proper JSON parsing
    });
};

// FIX: Add missing 'analyzeLeadData' function.
export const analyzeLeadData = async (leads: Lead[]): Promise<string> => {
    checkOnlineAndAIOff();
    return withRetry(async (signal) => {
        const prompt = `以下のリードデータ（${leads.length}件）を分析し、営業活動に関する簡潔なインサイトや提案を1つ生成してください。
        特に、有望なリードの傾向や、アプローチすべきセグメントなどを指摘してください。
        
        データサンプル:
        ${JSON.stringify(leads.slice(0, 3).map(l => ({ company: l.company, status: l.status, inquiryType: l.inquiryType, message: l.message })), null, 2)}
        `;
        const response = await ai.models.generateContent({ model, contents: prompt, config: { signal } });
        return response.text;
    });
};

// FIX: Add missing 'createLeadProposalPackage' function.
const proposalPackageSchema = {
    type: Type.OBJECT,
    properties: {
        isSalesLead: { type: Type.BOOLEAN, description: "提供された情報が営業メールや無関係な問い合わせではなく、実際のビジネスリードである可能性が高いかどうか。" },
        reason: { type: Type.STRING, description: "isSalesLeadの判断理由を簡潔に説明してください。" },
        proposal: {
            type: Type.OBJECT,
            description: "isSalesLeadがtrueの場合に生成される提案書コンテンツ。営業リードでない場合はnull。",
            properties: {
                coverTitle: { type: Type.STRING, description: "提案書のタイトル。例:「〇〇株式会社様向け Webサイト連携 DM施策のご提案」" },
                businessUnderstanding: { type: Type.STRING, description: "顧客の事業内容や現状の理解をまとめたセクション。" },
                challenges: { type: Type.STRING, description: "顧客が抱えているであろう課題やニーズを仮説立てて記述するセクション。" },
                proposal: { type: Type.STRING, description: "具体的な提案内容。当社のサービスがどのように課題解決に貢献できるかを記述。" },
                conclusion: { type: Type.STRING, description: "提案のまとめと次のステップを記述するセクション。" },
            }
        },
        estimate: {
            type: Type.ARRAY,
            description: "isSalesLeadがtrueの場合に生成される見積項目案。営業リードでない場合はnull。",
            items: {
                type: Type.OBJECT,
                properties: {
                    division: { type: Type.STRING, enum: ['用紙代', 'デザイン・DTP代', '刷版代', '印刷代', '加工代', 'その他', '初期費用', '月額費用'] },
                    content: { type: Type.STRING, description: "具体的な作業内容や品名。" },
                    quantity: { type: Type.NUMBER },
                    unit: { type: Type.STRING },
                    unitPrice: { type: Type.NUMBER },
                    price: { type: Type.NUMBER, description: "数量 x 単価" },
                    cost: { type: Type.NUMBER, description: "原価" },
                    costRate: { type: Type.NUMBER, description: "原価率 (cost/price)" },
                    subtotal: { type: Type.NUMBER, description: "priceと同じ" }
                },
            }
        },
    },
    required: ["isSalesLead", "reason"],
};

export const createLeadProposalPackage = async (lead: Lead): Promise<LeadProposalPackage> => {
    checkOnlineAndAIOff();
    return withRetry(async (signal) => {
        const prompt = `以下のリード情報とWeb検索の結果を基に、提案パッケージを生成してください。
まず、このリードが実際のビジネスチャンス（営業リード）であるか、それとも単なる営業メールや無関係な問い合わせであるかを判断してください。
ビジネスチャンスであると判断した場合のみ、提案書コンテンツと見積項目案を生成してください。

リード情報:
- 会社名: ${lead.company}
- 担当者名: ${lead.name}
- 問い合わせ内容: ${lead.message || '具体的な内容は記載されていません。'}

Web検索を活用して、企業の事業内容、最近の動向、および問い合わせ内容に関連する業界の課題を調査してください。
その上で、当社の印刷・物流サービスがどのように役立つかを具体的に提案してください。
必ず指定されたJSON形式で出力してください。`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-pro",
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
                signal,
                responseMimeType: "application/json",
                responseSchema: proposalPackageSchema,
                thinkingConfig: { thinkingBudget: 32768 },
            },
        });

        let jsonStr = response.text.trim();
        if (jsonStr.startsWith('```json')) {
            jsonStr = jsonStr.substring(7, jsonStr.length - 3).trim();
        }
        
        try {
            return JSON.parse(jsonStr);
        } catch (e) {
            console.error("Failed to parse JSON from Gemini for proposal package:", e, "Raw text:", jsonStr);
            return {
                isSalesLead: false,
                reason: `AIからの応答を解析できませんでした。応答: ${jsonStr}`,
            };
        }
    });
};

export const getDashboardSuggestion = async (jobs: Job[]): Promise<string> => {
    checkOnlineAndAIOff();
    return withRetry(async (signal) => {
        const recentJobs = jobs.slice(0, 5).map(j => ({
            title: j.title,
            price: j.price,
            variableCost: j.variableCost,
            margin: j.price - j.variableCost,
            marginRate: j.price > 0 ? ((j.price - j.variableCost) / j.price) * 100 : 0
        }));

        const prompt = `あなたは印刷会社の経営コンサルタントです。以下の最近の案件データ（${recentJobs.length}件）を分析し、経営改善のための具体的で簡潔な提案を1つしてください。多角的な視点（収益性、効率性、戦略的価値）から分析し、 actionable な提案を生成してください。

データサンプル:
${JSON.stringify(recentJobs, null, 2)}
`;
        const response = await ai.models.generateContent({ model, contents: prompt, config: { signal } });
        return response.text;
    });
};

export const generateDailyReportSummary = async (customerName: string, activityContent: string): Promise<string> => {
    checkOnlineAndAIOff();
    return withRetry(async (signal) => {
        const prompt = `以下のキーワードを元に、営業日報の活動内容をビジネス文書としてまとめてください。
訪問先: ${customerName}
キーワード: ${activityContent}`;
        const response = await ai.models.generateContent({ model, contents: prompt, config: { signal } });
        return response.text;
    });
};

export const generateWeeklyReportSummary = async (keywords: string): Promise<string> => {
    checkOnlineAndAIOff();
    return withRetry(async (signal) => {
        const prompt = `以下のキーワードを元に、週報の報告内容をビジネス文書としてまとめてください。
キーワード: ${keywords}`;
        const response = await ai.models.generateContent({ model, contents: prompt, config: { signal } });
        return response.text;
    });
};

// FIX: Add missing 'parseLineItems' function.
export const parseLineItems = async (prompt: string): Promise<EstimateLineItem[]> => {
  checkOnlineAndAIOff();
  const schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: "具体的な作業内容や品名。用紙の種類や厚さ、加工の種類などを記載。" },
        description: { type: Type.STRING, description: "品目の詳細説明（オプション）" },
        qty: { type: Type.NUMBER, description: "数量。単位と対応させる。" },
        unit: { type: Type.STRING, description: "単位（例：部, 枚, 式, 連, 月）" },
        unitPrice: { type: Type.NUMBER, description: "単価" },
        taxRate: { type: Type.NUMBER, description: "適用される税率。小数点形式（例: 0.1）。", default: 0.1 },
      },
      required: ["name", "qty", "unitPrice"]
    }
  };

  const fullPrompt = `以下のテキストから見積の明細項目を抽出してください。印刷会社の標準的な項目で構成し、現実的な単価を設定してください。
テキスト: "${prompt}"`;
  
  const response = await ai.models.generateContent({
    model,
    contents: fullPrompt,
    config: { responseMimeType: "application/json", responseSchema: schema },
  });

  let jsonStr = response.text.trim();
  if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.substring(7, jsonStr.length - 3).trim();
  }
  return JSON.parse(jsonStr);
};


const parseNumbersLikeJPY = (value: string): number | undefined => {
  const v = value.replace(/[^\d.-]/g, '');
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

const roughExtractLines = (text: string): EstimateLineItem[] => {
  // 例: 「名刺100部 @¥2,500」「A4パンフ 1式 ¥120,000 税別10%」
  const lines: EstimateLineItem[] = [];
  text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((line) => {
      // 数量/単価/合計のいずれかが見える行を簡易抽出
      const qtyMatch = line.match(/(\d+)\s*(部|枚|式|箱|冊|本|件)?/);
      const priceMatch = line.match(/[@＠]?\s*[¥￥]?\s*([\d,]+)(?:\s*円)?/);
      if (qtyMatch && priceMatch) {
        const qty = Number(qtyMatch[1]);
        const unit = qtyMatch[2] || '式';
        const unitPrice = parseNumbersLikeJPY(priceMatch[1]) ?? 0;
        lines.push({
          name: line.replace(/\s*[@＠].*$/, ''),
          qty,
          unit,
          unitPrice,
          taxRate: 0.1,
        });
      }
    });
  if (lines.length === 0) {
    // 最低1行用意
    lines.push({ name: '一式', qty: 1, unit: '式', unitPrice: 0, taxRate: 0.1 });
  }
  return lines;
};

const roughExtractCustomer = (text: string): ExtractedParty[] => {
  const email = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/)?.[0];
  const company = text.match(/(株|株式会社|有限会社|合同会社)[^\s　]+/)?.[0];
  const person = text.match(/(様|御中)/) ? text.split(/\r?\n/)[0].replace(/様|御中/g, '') : undefined;
  return [
    {
      company,
      person,
      email,
      confidence: 0.6,
    },
  ].filter(c => c.company || c.person || c.email);
};

export async function createDraftEstimate(inputText: string, files: { data: string; mimeType: string }[] = []): Promise<EstimateDraft> {
    checkOnlineAndAIOff();

    const contents: any[] = [];
    const supportedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (inputText) {
        contents.push({ text: inputText });
    }
    files.forEach(file => {
        if(supportedMimeTypes.includes(file.mimeType)) {
            contents.push({ inlineData: { data: file.data, mimeType: file.mimeType } });
        }
    });

    const fullPrompt = `あなたは日本の印刷会社で20年以上の経験を持つベテランの見積担当者です。
以下の顧客からの要望テキストと添付ファイルに基づき、現実的で詳細な見積書の下書きを生成してください。
顧客情報、件名候補、納期、支払条件、品目を正確に抽出し、原価計算も行い、適切な利益を乗せた単価と金額を設定してください。
【最重要】顧客の要望が複雑な場合や、複数の作業項目を示唆している場合は、必ずそれらを分解して複数行の詳細な見積明細を作成してください。例えば「チラシと名刺」という依頼なら、チラシの行と名刺の行を分けてください。「準備作業と印刷」なら、それぞれ別の行にしてください。
【重要】もし顧客の要望が倉庫管理、定期発送、サブスクリプション型のサービスを示唆している場合、必ず「初期費用」と「月額費用」の項目を立てて見積を作成してください。その際の単位は、初期費用なら「式」、月額費用なら「月」としてください。
抽出されたデータは必ずJSON形式で出力してください。

JSONスキーマ:
${JSON.stringify({
    type: Type.OBJECT,
    properties: {
        draftId: { type: Type.STRING, description: "ドラフトID (UUID)" },
        sourceSummary: { type: Type.STRING, description: "解析元の簡易要約" },
        customerCandidates: {
            type: Type.ARRAY,
            description: "検出された顧客の候補リスト。",
            items: {
                type: Type.OBJECT,
                properties: {
                    company: { type: Type.STRING },
                    person: { type: Type.STRING },
                    email: { type: Type.STRING },
                    tel: { type: Type.STRING },
                    address: { type: Type.STRING },
                    confidence: { type: Type.NUMBER, description: "信頼度スコア (0-1)" },
                },
            },
        },
        subjectCandidates: {
            type: Type.ARRAY,
            description: "検出された件名候補リスト。",
            items: { type: Type.STRING },
        },
        paymentTerms: { type: Type.STRING, description: "支払条件。例：「月末締め翌月末払い」。曖昧な表現は解決。" },
        deliveryTerms: { type: Type.STRING, description: "納品条件。例：「指定倉庫へ一括納品」。" },
        deliveryMethod: { type: Type.STRING, description: "納品方法。例：「宅配便」。" },
        currency: { type: Type.STRING, description: "見積で使用される通貨。ISO 4217コード（例: JPY）。", default: "JPY" },
        taxInclusive: { type: Type.BOOLEAN, description: "金額が税込みかどうかのフラグ。", default: false },
        dueDate: { type: Type.STRING, description: "希望納期 (YYYY-MM-DD形式)。曖昧な表現は解決。" },
        items: {
            type: Type.ARRAY,
            description: "見積の明細項目。印刷会社の標準的な項目で構成する。",
            items: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING, description: "具体的な作業内容や品名。用紙の種類や厚さ、加工の種類などを記載。" },
                    description: { type: Type.STRING, description: "品目の詳細説明（オプション）" },
                    qty: { type: Type.NUMBER, description: "数量。単位と対応させる。" },
                    unit: { type: Type.STRING, description: "単位（例：部, 枚, 式, 連, 月）" },
                    unitPrice: { type: Type.NUMBER, description: "単価" },
                    taxRate: { type: Type.NUMBER, description: "適用される税率。小数点形式（例: 0.1）。", default: 0.1 },
                },
                required: ["name", "qty", "unitPrice"]
            }
        },
        notes: { type: Type.STRING, description: "見積書全体の補足事項や備考。見積の有効期限なども記載する。" },
    },
    required: ["customerCandidates", "subjectCandidates", "items", "currency"],
}, null, 2)}
`;
    const response = await ai.models.generateContent({
        model: "gemini-2.5-pro", // Use pro model for complex extraction
        contents: [...contents, { text: fullPrompt }],
        config: {
            thinkingConfig: { thinkingBudget: 32768 },
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    draftId: { type: Type.STRING },
                    sourceSummary: { type: Type.STRING },
                    customerCandidates: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                company: { type: Type.STRING },
                                person: { type: Type.STRING },
                                email: { type: Type.STRING },
                                tel: { type: Type.STRING },
                                address: { type: Type.STRING },
                                confidence: { type: Type.NUMBER },
                            },
                        },
                    },
                    subjectCandidates: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                    },
                    paymentTerms: { type: Type.STRING },
                    deliveryTerms: { type: Type.STRING },
                    deliveryMethod: { type: Type.STRING },
                    currency: { type: Type.STRING },
                    taxInclusive: { type: Type.BOOLEAN },
                    dueDate: { type: Type.STRING },
                    items: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                name: { type: Type.STRING },
                                description: { type: Type.STRING },
                                qty: { type: Type.NUMBER },
                                unit: { type: Type.STRING },
                                unitPrice: { type: Type.NUMBER },
                                taxRate: { type: Type.NUMBER },
                            },
                        },
                    },
                    notes: { type: Type.STRING },
                },
                required: ["customerCandidates", "subjectCandidates", "items", "currency"],
            },
        },
    });

    let jsonStr = response.text.trim();
    if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.substring(7, jsonStr.length - 3).trim();
    }
    
    // Parse the response
    const parsed: EstimateDraft = JSON.parse(jsonStr);

    // Ensure items and candidates arrays exist and have defaults if missing
    if (!parsed.items) {
        parsed.items = [{ name: '一式', qty: 1, unit: '式', unitPrice: 0, taxRate: 0.1 }];
    }
    if (!parsed.customerCandidates || parsed.customerCandidates.length === 0) {
        parsed.customerCandidates = roughExtractCustomer(inputText);
    }
    if (!parsed.subjectCandidates || parsed.subjectCandidates.length === 0) {
        const subjectGuess = inputText.match(/(件名|Subject)[:：]\s*(.+)$/m)?.[2]?.trim() || inputText.split(/\r?\n/).find((s) => s.length >= 5)?.slice(0, 40) || '御見積のご送付';
        parsed.subjectCandidates = [subjectGuess];
    }
    
    // Default values if not extracted
    parsed.draftId = uuidv4() as UUID;
    if (!parsed.deliveryTerms) parsed.deliveryTerms = '通常納期（要確認）';
    if (!parsed.paymentTerms) parsed.paymentTerms = '当月末締め翌月末支払（銀行振込）';
    if (!parsed.deliveryMethod) parsed.deliveryMethod = 'メール送付';
    if (!parsed.notes) parsed.notes = 'AIによる自動生成見積下書きです。内容は担当者にご確認ください。';
    if (!parsed.currency) parsed.currency = 'JPY';
    if (parsed.taxInclusive === undefined) parsed.taxInclusive = false;
    if (!parsed.sourceSummary) parsed.sourceSummary = inputText.slice(0, 240);


    return parsed;
};

// FIX: Add missing 'createProjectFromInputs' function.
const projectCreationSchema = {
    type: Type.OBJECT,
    properties: {
        projectName: { type: Type.STRING, description: "案件のタイトル。顧客からの要望を要約した、簡潔で分かりやすい名前。" },
        customerName: { type: Type.STRING, description: "顧客の会社名。テキストやファイルから抽出する。" },
        overview: { type: Type.STRING, description: "案件全体の概要。AIが生成したサマリー。" },
        extracted_details: { type: Type.STRING, description: "案件の主要な要件や仕様。箇条書きでまとめる。" },
        file_categorization: {
            type: Type.ARRAY,
            description: "添付された各ファイルの分類。",
            items: {
                type: Type.OBJECT,
                properties: {
                    fileName: { type: Type.STRING, description: "元のファイル名。" },
                    category: { type: Type.STRING, description: "ファイルのカテゴリ（例: '仕様書', 'デザイン案', '参考資料', 'その他'）。" },
                },
                required: ["fileName", "category"]
            }
        },
    },
    required: ["projectName", "customerName", "overview", "extracted_details", "file_categorization"],
};

export const createProjectFromInputs = async (
    inputText: string, 
    files: { name: string; data: string; mimeType: string }[]
): Promise<{
    projectName: string;
    customerName: string;
    overview: string;
    extracted_details: string;
    file_categorization: { fileName: string; category: string }[];
}> => {
    checkOnlineAndAIOff();
    
    const contents: any[] = [];
    const supportedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (inputText) {
        contents.push({ text: `顧客からの要望テキスト:\n${inputText}` });
    }
    files.forEach(file => {
        if(supportedMimeTypes.includes(file.mimeType)) {
            contents.push({ text: `添付ファイル名: ${file.name}` });
            contents.push({ inlineData: { data: file.data, mimeType: file.mimeType } });
        }
    });

    const fullPrompt = `あなたは日本の印刷会社で20年以上の経験を持つベテランのプロジェクトマネージャーです。
以下の顧客からの要望テキストと添付ファイルの内容を総合的に分析し、新しい案件プロジェクトを作成してください。
- 案件の全体像を理解し、要約した「概要」を生成してください。
- 重要な仕様（サイズ、色、数量、納期など）を「抽出された情報」として箇条書きでまとめてください。
- 添付された各ファイルを内容に基づいて分類してください。
- 全ての情報から、案件にふさわしい「案件名」と「顧客名」を特定してください。
抽出されたデータは必ずJSON形式で出力してください。`;
    contents.push({ text: fullPrompt });

    const response = await ai.models.generateContent({
        model: "gemini-2.5-pro",
        contents: contents,
        config: {
            responseMimeType: "application/json",
            responseSchema: projectCreationSchema,
            thinkingConfig: { thinkingBudget: 32768 },
        },
    });

    let jsonStr = response.text.trim();
    if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.substring(7, jsonStr.length - 3).trim();
    }

    try {
        return JSON.parse(jsonStr);
    } catch (e) {
        console.error("Failed to parse JSON from Gemini for project creation:", e);
        throw new Error(`AIからの応答を解析できませんでした: ${e instanceof Error ? e.message : String(e)}`);
    }
};

// FIX: ADD generateProposalSection
export const generateProposalSection = async (sectionTitle: string, customer: Customer, job: Job | null, estimate: Estimate | null): Promise<string> => {
    checkOnlineAndAIOff();
    return withRetry(async (signal) => {
        const prompt = `あなたは経験豊富な営業コンサルタントです。以下の顧客情報、案件情報、見積情報に基づいて、提案書の「${sectionTitle}」セクションを作成してください。プロフェッショナルで説得力のある文章を生成してください。

### 顧客情報
- 会社名: ${customer.customerName}
- 事業内容: ${customer.companyContent || 'N/A'}

### 関連案件情報
${job ? `- 案件名: ${job.title}\n- 数量: ${job.quantity}\n- 仕様: ${job.details}` : '- なし'}

### 関連見積情報
${estimate ? `- 件名: ${estimate.title}\n- 合計金額: ${formatJPY(estimate.grandTotal)}` : '- なし'}

セクション「${sectionTitle}」の本文のみを生成してください。見出しは不要です。`;

        const response = await ai.models.generateContent({ model: "gemini-2.5-pro", contents: prompt, config: { signal } });
        return response.text;
    });
};

// FIX: ADD parseApprovalDocument
const parseApprovalDocumentSchema = {
    type: Type.OBJECT,
    properties: {
        title: { type: Type.STRING, description: "稟議書の件名" },
        details: { type: Type.STRING, description: "稟議書の目的・概要・詳細な内容" }
    },
    required: ["title", "details"]
};

export const parseApprovalDocument = async (base64Data: string, mimeType: string): Promise<{ title: string; details: string }> => {
    checkOnlineAndAIOff();
    return withRetry(async (signal) => {
        const imagePart = { inlineData: { data: base64Data, mimeType } };
        const textPart = { text: "この画像またはPDFファイルから、稟議書の件名と詳細内容を抽出してください。" };

        const response = await ai.models.generateContent({
            model: "gemini-2.5-pro",
            contents: { parts: [imagePart, textPart] },
            config: {
                responseMimeType: "application/json",
                responseSchema: parseApprovalDocumentSchema,
                signal
            }
        });
        const jsonStr = response.text.trim().replace(/^```json\n|\n```$/g, '');
        return JSON.parse(jsonStr);
    });
};

// FIX: ADD startBusinessConsultantChat
export const startBusinessConsultantChat = (): Chat => {
    if (NEXT_PUBLIC_AI_OFF) {
        throw new Error('AI機能は現在無効です。');
    }
    const systemInstruction = `あなたは経験豊富な経営コンサルタントです。ユーザーは印刷会社の従業員です。提供された社内データ（案件情報、顧客情報、会計情報など）のコンテキストを理解し、具体的で実践的なアドバイスを提供してください。必要に応じてWeb検索も活用し、市場のトレンドや競合の動向も踏まえた回答を心がけてください。`;
    return ai.chats.create({
        model: "gemini-2.5-pro",
        config: {
            systemInstruction,
            tools: [{ googleSearch: {} }],
        },
    });
};

// FIX: ADD generateClosingSummary
export const generateClosingSummary = async (
    type: '月次' | '四半期' | '年次',
    currentPeriodJobs: Job[],
    previousPeriodJobs: Job[],
    currentPeriodJournal: JournalEntry[],
    previousPeriodJournal: JournalEntry[],
): Promise<string> => {
    checkOnlineAndAIOff();
    return withRetry(async (signal) => {
        const prompt = `あなたは優秀な会計アナリストです。以下のデータに基づいて、${type}決算のサマリーを生成してください。
- 主要なKPI（売上、利益など）の前期間比較
- 特筆すべき点や業績の変動要因
- 今後の経営に向けた簡潔なアドバイス

### 今期間データ
- 案件数: ${currentPeriodJobs.length}
- 売上合計: ${formatJPY(currentPeriodJobs.reduce((sum, j) => sum + j.price, 0))}
- 限界利益合計: ${formatJPY(currentPeriodJobs.reduce((sum, j) => sum + (j.price - j.variableCost), 0))}
- 経費合計: ${formatJPY(currentPeriodJournal.reduce((sum, j) => sum + j.debit, 0))}

### 前期間データ
- 案件数: ${previousPeriodJobs.length}
- 売上合計: ${formatJPY(previousPeriodJobs.reduce((sum, j) => sum + j.price, 0))}
- 限界利益合計: ${formatJPY(previousPeriodJobs.reduce((sum, j) => sum + (j.price - j.variableCost), 0))}
- 経費合計: ${formatJPY(previousPeriodJournal.reduce((sum, j) => sum + j.debit, 0))}

上記データから、洞察に富んだサマリーを生成してください。`;

        const response = await ai.models.generateContent({ model: "gemini-2.5-pro", contents: prompt, config: { signal } });
        return response.text;
    });
};

// FIX: ADD startBugReportChat
export const startBugReportChat = (): Chat => {
    if (NEXT_PUBLIC_AI_OFF) {
        throw new Error('AI機能は現在無効です。');
    }
    const systemInstruction = `あなたはバグ報告・改善要望の受付アシスタントです。ユーザーからの自然言語での報告をヒアリングし、最終的に以下のJSON形式で情報を整理して出力してください。必要な情報が足りない場合は、追加で質問してください。JSON以外のテキストは絶対に出力しないでください。
{
  "report_type": "'bug' or 'improvement'",
  "summary": "簡潔な件名",
  "description": "問題の詳細な説明。再現手順、期待される動作、実際の動作などを含む。"
}`;
    return ai.chats.create({
        model,
        config: {
            systemInstruction,
            responseMimeType: "application/json",
        },
    });
};

// FIX: ADD processApplicationChat
export const processApplicationChat = async (
    history: { role: 'user' | 'model', content: string }[],
    appCodes: ApplicationCode[],
    users: User[],
    approvalRoutes: ApprovalRoute[]
): Promise<string> => {
    checkOnlineAndAIOff();
    return withRetry(async (signal) => {
        const latestMessage = history[history.length - 1].content;
        const prompt = `あなたは社内申請アシスタントです。ユーザーからの自然言語での申請内容をヒアリングし、最終的に以下のJSON形式で情報を整理して出力してください。
必要な情報が足りない場合は、ユーザーに追加で質問してください。
ユーザーとの会話履歴と、利用可能なマスターデータを参考にしてください。
最終的なJSONオブジェクトのみを出力し、それ以外のテキストは絶対に追加しないでください。
JSON出力例:
{
  "applicationCodeId": "利用可能な申請種別ID",
  "formData": { /* 申請フォームのスキーマに沿ったデータ */ },
  "approvalRouteId": "利用可能な承認ルートID"
}

--- 会話履歴 ---
${history.map(m => `${m.role}: ${m.content}`).join('\n')}

--- 利用可能なマスターデータ ---
- 申請種別: ${JSON.stringify(appCodes.map(c => ({ id: c.id, name: c.name, code: c.code })))}
- ユーザー: ${JSON.stringify(users.map(u => ({ id: u.id, name: u.name })))}
- 承認ルート: ${JSON.stringify(approvalRoutes.map(r => ({ id: r.id, name: r.name })))}

--- ユーザーの最新の入力 ---
"${latestMessage}"

上記に基づいて、次の応答（質問または最終的なJSON）を生成してください。`;

        const response = await ai.models.generateContent({ model, contents: prompt, config: { signal } });
        return response.text.trim();
    });
};

// FIX: ADD generateMarketResearchReport
const marketResearchSchema = {
    type: Type.OBJECT,
    properties: {
        title: { type: Type.STRING, description: "レポートのタイトル" },
        summary: { type: Type.STRING, description: "調査結果の要約" },
        trends: { type: Type.ARRAY, items: { type: Type.STRING }, description: "主要な市場トレンドのリスト" },
        competitorAnalysis: { type: Type.STRING, description: "主要な競合他社の分析" },
        opportunities: { type: Type.ARRAY, items: { type: Type.STRING }, description: "ビジネスチャンスのリスト" },
        threats: { type: Type.ARRAY, items: { type: Type.STRING }, description: "脅威やリスクのリスト" },
    },
    required: ["title", "summary", "trends", "competitorAnalysis", "opportunities", "threats"],
};

export const generateMarketResearchReport = async (topic: string): Promise<MarketResearchReport> => {
    checkOnlineAndAIOff();
    return withRetry(async (signal) => {
        const prompt = `以下のトピックについて、Web検索を活用して詳細な市場調査レポートをJSON形式で作成してください。
トピック: "${topic}"`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-pro",
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
                responseMimeType: "application/json",
                responseSchema: marketResearchSchema,
                signal,
                thinkingConfig: { thinkingBudget: 32768 },
            },
        });
        
        let jsonStr = response.text.trim().replace(/^```json\n|\n```$/g, '');
        const result = JSON.parse(jsonStr);

        const rawChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        const sources = rawChunks.map((chunk: any) => chunk.web).filter(Boolean).map((webChunk: any) => ({ uri: webChunk.uri, title: webChunk.title }));
        const uniqueSources = Array.from(new Map(sources.map(item => [item.uri, item])).values());
        
        return { ...result, sources: uniqueSources };
    });
};

// FIX: ADD Live API helper functions
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export function createBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

interface LiveChatCallbacks {
    onTranscription: (type: 'input' | 'output', text: string) => void;
    onAudioChunk: (base64Audio: string) => void;
    onTurnComplete: () => void;
    onError: (e: ErrorEvent) => void;
    onClose: (e: CloseEvent) => void;
    onInterrupted: () => void;
}

export const startLiveChatSession = async (callbacks: LiveChatCallbacks): Promise<any> => {
    checkOnlineAndAIOff();
    const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
            onopen: () => {
                console.debug('Live session opened');
            },
            onmessage: async (message: LiveServerMessage) => {
                if (message.serverContent?.outputTranscription) {
                    callbacks.onTranscription('output', message.serverContent.outputTranscription.text);
                }
                if (message.serverContent?.inputTranscription) {
                    callbacks.onTranscription('input', message.serverContent.inputTranscription.text);
                }
                if (message.serverContent?.turnComplete) {
                    callbacks.onTurnComplete();
                }
                const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                if (base64Audio) {
                    callbacks.onAudioChunk(base64Audio);
                }
                if(message.serverContent?.interrupted){
                    callbacks.onInterrupted();
                }
            },
            onerror: callbacks.onError,
            onclose: callbacks.onClose,
        },
        config: {
            responseModalities: [Modality.AUDIO],
            inputAudioTranscription: {},
            outputAudioTranscription: {},
        },
    });
    return sessionPromise;
};