import { useState, useEffect } from 'react';

interface VersionInfo {
    version: string;
    name: string;
    buildDate: string;
    changelog: string;
}

interface UseVersionResult {
    currentVersion: VersionInfo | null;
    isLoading: boolean;
    hasUpdate: boolean;
    checkForUpdates: () => Promise<boolean>;
}

const STORAGE_KEY = 'terapeuta-ia-last-version';

export const useVersion = (): UseVersionResult => {
    const [currentVersion, setCurrentVersion] = useState<VersionInfo | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [hasUpdate, setHasUpdate] = useState(false);

    useEffect(() => {
        loadVersion();
    }, []);

    const loadVersion = async () => {
        try {
            // Buscar versão do arquivo público
            const response = await fetch('/version.json?t=' + Date.now());
            const version: VersionInfo = await response.json();
            setCurrentVersion(version);

            // Verificar se há atualização
            const lastSeenVersion = localStorage.getItem(STORAGE_KEY);
            if (lastSeenVersion && lastSeenVersion !== version.version) {
                setHasUpdate(true);
            }
        } catch (error) {
            console.error('Error loading version:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const checkForUpdates = async (): Promise<boolean> => {
        try {
            const response = await fetch('/version.json?t=' + Date.now());
            const newVersion: VersionInfo = await response.json();

            if (currentVersion && newVersion.version !== currentVersion.version) {
                setHasUpdate(true);
                setCurrentVersion(newVersion);
                return true;
            }
            return false;
        } catch {
            return false;
        }
    };

    return {
        currentVersion,
        isLoading,
        hasUpdate,
        checkForUpdates,
    };
};

export const markVersionAsSeen = (version: string) => {
    localStorage.setItem(STORAGE_KEY, version);
};
