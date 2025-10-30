import React, { useState, useEffect, useRef } from 'react';
import { Loader, Save, GoogleIcon } from '../Icons.tsx';
import { Toast } from '../../types.ts';

interface GoogleSettingsPageProps {
    addToast: (message: string, type: Toast['type']) => void;
}

const GoogleSettingsPage: React.FC<GoogleSettingsPageProps> = ({ addToast }) => {
    const [settings, setSettings] = useState({
        clientId: '',
        clientSecret: '',
    });
    const [isSaving, setIsSaving] = useState(false);
    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;
        try {
            const savedSettings = localStorage.getItem('googleSettings');
            if (savedSettings) {
                setSettings(JSON.parse(savedSettings));
            }
        } catch (error) {
            console.error("Failed to load Google settings from localStorage", error);
        }

        return () => {
            mounted.current = false;
        };
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setSettings(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setTimeout(() => {
            if (mounted.current) {
                localStorage.setItem('googleSettings', JSON.stringify(settings));
                setIsSaving(false);
                addToast('Google連携設定が保存されました。', 'success');
            }
        }, 1000);
    };

    const inputClass = "w-full text-base bg-slate-50 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg p-2.5 focus:ring-blue-500 focus:border-blue-500";
    const labelClass = "block text-base font-medium text-slate-700 dark:text-slate-300 mb-1.5";

    return (
        <form onSubmit={handleSave} className="space-y-8 max-w-3xl mx-auto">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                    <h2 className="text-xl font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                        <GoogleIcon className="w-6 h-6" />
                        Google連携設定
                    </h2>
                    <p className="mt-1 text-base text-slate-500 dark:text-slate-400">
                        Googleログインや関連APIの連携に必要な認証情報を設定します。
                    </p>
                </div>
                <div className="p-6 space-y-6">
                    <div>
                        <label htmlFor="clientId" className={labelClass}>Google Client ID</label>
                        <input
                            type="text"
                            id="clientId"
                            name="clientId"
                            value={settings.clientId}
                            onChange={handleChange}
                            className={inputClass}
                            placeholder="xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com"
                        />
                    </div>
                    <div>
                        <label htmlFor="clientSecret" className={labelClass}>Google Client Secret</label>
                        <input
                            type="password"
                            id="clientSecret"
                            name="clientSecret"
                            value={settings.clientSecret}
                            onChange={handleChange}
                            className={inputClass}
                            placeholder="GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx"
                        />
                    </div>
                </div>
            </div>

            <div className="flex justify-end">
                <button
                    type="submit"
                    disabled={isSaving}
                    className="w-48 flex items-center justify-center gap-2 bg-blue-600 text-white font-semibold py-2.5 px-4 rounded-lg shadow-md hover:bg-blue-700 disabled:bg-slate-400"
                >
                    {isSaving ? <Loader className="w-5 h-5 animate-spin"/> : <Save className="w-5 h-5" />}
                    <span>{isSaving ? '保存中...' : '設定を保存'}</span>
                </button>
            </div>
        </form>
    );
};

export default GoogleSettingsPage;