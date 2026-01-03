import { useState, useEffect, useCallback, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Loader2, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CityResult {
    display_name: string;
    lat: string;
    lon: string;
    place_id: string;
    address?: {
        city?: string;
        town?: string;
        village?: string;
        municipality?: string;
        state?: string;
        country?: string;
    };
}

export interface CitySelection {
    name: string;
    fullName: string;
    lat: number;
    lng: number;
}

interface CityAutocompleteProps {
    value: string;
    onChange: (value: string, selection?: CitySelection) => void;
    placeholder?: string;
    className?: string;
}

// Abreviações de estados brasileiros
const stateAbbreviations: Record<string, string> = {
    'Rio Grande do Sul': 'RS', 'Santa Catarina': 'SC', 'Paraná': 'PR',
    'São Paulo': 'SP', 'Rio de Janeiro': 'RJ', 'Minas Gerais': 'MG',
    'Espírito Santo': 'ES', 'Bahia': 'BA', 'Sergipe': 'SE', 'Alagoas': 'AL',
    'Pernambuco': 'PE', 'Paraíba': 'PB', 'Rio Grande do Norte': 'RN',
    'Ceará': 'CE', 'Piauí': 'PI', 'Maranhão': 'MA', 'Tocantins': 'TO',
    'Goiás': 'GO', 'Mato Grosso': 'MT', 'Mato Grosso do Sul': 'MS',
    'Distrito Federal': 'DF', 'Pará': 'PA', 'Amapá': 'AP', 'Roraima': 'RR',
    'Amazonas': 'AM', 'Acre': 'AC', 'Rondônia': 'RO'
};

function getSimplifiedName(city: CityResult): string {
    if (!city.address) {
        const parts = city.display_name.split(',');
        if (parts.length >= 3) {
            return `${parts[0].trim()}, ${parts[parts.length - 2].trim()}, ${parts[parts.length - 1].trim()}`;
        }
        return parts.slice(0, 2).join(', ');
    }

    const cityName = city.address.city || city.address.town || city.address.village || city.address.municipality || '';
    const state = city.address.state || '';
    const country = city.address.country || '';

    // Abreviar estado se for do Brasil
    let stateAbbr = state;
    if (country === 'Brasil' || country === 'Brazil') {
        stateAbbr = stateAbbreviations[state] || state;
    }

    if (cityName && stateAbbr && country) {
        return `${cityName}, ${stateAbbr}, ${country}`;
    } else if (cityName && country) {
        return `${cityName}, ${country}`;
    }

    return city.display_name.split(',').slice(0, 2).join(', ');
}

export function CityAutocomplete({ value, onChange, placeholder = "Digite o nome da cidade", className }: CityAutocompleteProps) {
    const [query, setQuery] = useState(value || '');
    const [results, setResults] = useState<CityResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const containerRef = useRef<HTMLDivElement>(null);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (value !== query) {
            setQuery(value || '');
        }
    }, [value]);

    const searchCities = useCallback(async (searchQuery: string) => {
        if (searchQuery.length < 3) {
            setResults([]);
            setIsOpen(false);
            return;
        }

        setIsLoading(true);
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=8&addressdetails=1`,
                { headers: { 'User-Agent': 'MyHealingChat/1.0' } }
            );

            if (response.ok) {
                const data = await response.json();
                setResults(data);
                setIsOpen(data.length > 0);
                setSelectedIndex(-1);
            }
        } catch (error) {
            console.error('Error searching cities:', error);
            setResults([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setQuery(newValue);
        onChange(newValue);

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => searchCities(newValue), 300);
    };

    const handleSelect = (city: CityResult) => {
        const simplifiedName = getSimplifiedName(city);
        const selection: CitySelection = {
            name: simplifiedName,
            fullName: city.display_name,
            lat: parseFloat(city.lat),
            lng: parseFloat(city.lon)
        };

        setQuery(simplifiedName);
        onChange(simplifiedName, selection);
        setIsOpen(false);
        setResults([]);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!isOpen) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter' && selectedIndex >= 0) {
            e.preventDefault();
            handleSelect(results[selectedIndex]);
        } else if (e.key === 'Escape') {
            setIsOpen(false);
        }
    };

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div ref={containerRef} className="relative">
            <div className="relative">
                <Input
                    value={query}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    onFocus={() => results.length > 0 && setIsOpen(true)}
                    placeholder={placeholder}
                    className={cn("pr-10", className)}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                    )}
                </div>
            </div>

            {isOpen && results.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-lg shadow-lg max-h-60 overflow-auto">
                    {results.map((city, index) => {
                        const simplifiedName = getSimplifiedName(city);
                        return (
                            <button
                                key={city.place_id}
                                type="button"
                                onClick={() => handleSelect(city)}
                                className={cn(
                                    "w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors",
                                    index === selectedIndex && "bg-accent"
                                )}
                            >
                                <div className="flex items-center gap-2">
                                    <MapPin className="h-4 w-4 text-primary flex-shrink-0" />
                                    <div>
                                        <span className="font-medium">{simplifiedName}</span>
                                        <span className="block text-xs text-muted-foreground truncate max-w-[300px]">
                                            {city.display_name}
                                        </span>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
