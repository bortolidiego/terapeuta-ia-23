import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId } = await req.json();

    if (!userId) {
      throw new Error('User ID is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const rapidApiKey = Deno.env.get('RAPIDAPI_KEY') || '2d67dd8e0bmshfbb80d6755572eap17c395jsn1f2fc32be17c';

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Buscar dados de nascimento no perfil (incluindo coordenadas se existirem)
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('full_name, birth_date, birth_time, birth_city, birth_latitude, birth_longitude')
      .eq('user_id', userId)
      .single();

    if (profileError || !profile) {
      throw new Error('Profile not found or incomplete');
    }

    if (!profile.birth_date || !profile.birth_city) {
      throw new Error('Birth date and city are required in profile');
    }

    // Parse date and time
    // Usar split para evitar problemas de fuso horário do objeto Date
    const [yearStr, monthStr, dayStr] = profile.birth_date.split('-');
    const [hour, minute] = (profile.birth_time || '12:00').split(':').map(Number);

    // ============================================
    // COORDENADAS: Usar as salvas no perfil ou fazer geocodificação
    // ============================================
    let coords = { lat: -15.7942, lng: -47.8825 }; // Default: Brasília
    let timezone = 'America/Sao_Paulo';

    // Se já temos coordenadas salvas no perfil, usar direto!
    if (profile.birth_latitude && profile.birth_longitude) {
      coords = { lat: profile.birth_latitude, lng: profile.birth_longitude };
      console.log(`[astro-chart] Usando coordenadas salvas: ${coords.lat}, ${coords.lng}`);
    } else {
      // Senão, fazer geocodificação via Nominatim
      try {
        const geocodeUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(profile.birth_city)}&format=json&limit=1`;
        console.log(`[astro-chart] Buscando coordenadas para: ${profile.birth_city}`);

        const geoResponse = await fetch(geocodeUrl, {
          headers: {
            'User-Agent': 'MyHealingChat/1.0 (Therapeutic App)'
          }
        });

        if (geoResponse.ok) {
          const geoData = await geoResponse.json();
          if (geoData && geoData.length > 0) {
            coords = {
              lat: parseFloat(geoData[0].lat),
              lng: parseFloat(geoData[0].lon)
            };
            console.log(`[astro-chart] Geocodificação OK: ${profile.birth_city} -> ${coords.lat}, ${coords.lng}`);
          } else {
            console.warn(`[astro-chart] Cidade não encontrada: ${profile.birth_city}, usando Brasília como fallback`);
          }
        }
      } catch (geoError) {
        console.error('[astro-chart] Erro na geocodificação:', geoError);
      }
    }

    // Determinar timezone baseado na longitude
    if (coords.lng < -30 && coords.lng > -74) {
      timezone = coords.lng < -50 ? 'America/Sao_Paulo' : 'America/Recife';
    } else if (coords.lng >= -30 && coords.lng < 30) {
      timezone = 'Europe/London';
    } else if (coords.lng >= 30 && coords.lng < 100) {
      timezone = 'Asia/Kolkata';
    } else if (coords.lng >= 100) {
      timezone = 'Asia/Tokyo';
    } else {
      timezone = 'America/New_York';
    }

    console.log(`[astro-chart] Cidade: ${profile.birth_city}, Coordenadas: ${coords.lat}, ${coords.lng}, Timezone: ${timezone}`);

    // birthData usando latitude/longitude para precisão máxima
    const birthData = {
      year: parseInt(yearStr),
      month: parseInt(monthStr),
      day: parseInt(dayStr),
      // IMPORTANTE: 0 é um valor válido para meia-noite, não usar ||
      hour: hour !== undefined && hour !== null ? hour : 12,
      minute: minute !== undefined && minute !== null ? minute : 0,
      second: 0,
      latitude: coords.lat,
      longitude: coords.lng,
      timezone: timezone
    };

    console.log(`[astro-chart] Calculando mapa para ${userId}:`, JSON.stringify(birthData));

    // 2. Chamar RapidAPI para Natal Chart Data
    // A URL correta identificada é /api/v3/charts/natal
    const rapidApiUrl = 'https://best-astrology-api-natal-charts-transits-synastry.p.rapidapi.com/api/v3/charts/natal';

    const response = await fetch(rapidApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-rapidapi-host': 'best-astrology-api-natal-charts-transits-synastry.p.rapidapi.com',
        'x-rapidapi-key': rapidApiKey
      },
      body: JSON.stringify({
        subject: {
          name: profile.full_name || 'Usuário',
          birth_data: birthData
        },
        options: {
          house_system: 'P', // Placidus
          zodiac_type: 'Tropic',
          language: 'pt',
          // Incluir todos os planetas + Quíron + pontos importantes
          active_points: [
            'Sun', 'Moon', 'Mercury', 'Venus', 'Mars',
            'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto',
            'Chiron', 'Ascendant', 'Medium_Coeli'
          ]
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[astro-chart] Erro RapidAPI:', errorText);
      throw new Error(`RapidAPI error: ${response.status}`);
    }

    const astroData = await response.json();
    console.log('[astro-chart] Dados recebidos:', JSON.stringify(astroData).substring(0, 500));

    // 3. Extrair dados profundos para terapia
    // A estrutura da API: chart_data.planetary_positions = array [{name, sign, house, ...}]
    // house_cusps = array [{name: "Ascendant", sign, ...}]
    const chartData = astroData.chart_data || {};
    const planets = chartData.planetary_positions || [];
    const houses = chartData.house_cusps || [];
    const aspects = chartData.aspects || [];

    // Buscar planetas/pontos pelo nome no array
    const findPlanet = (name: string) => planets.find((p: any) => p.name === name);
    // Ascendente está em planetary_positions com name: "Ascendant"
    // Casa 1 em house_cusps tem house: 1
    const findHouseByNumber = (num: number) => houses.find((h: any) => h.house === num);

    const sun = findPlanet('Sun');
    const moon = findPlanet('Moon');
    const mercury = findPlanet('Mercury');
    const venus = findPlanet('Venus');
    const mars = findPlanet('Mars');
    const jupiter = findPlanet('Jupiter');
    const saturn = findPlanet('Saturn');
    const uranus = findPlanet('Uranus');
    const neptune = findPlanet('Neptune');
    const pluto = findPlanet('Pluto');
    const chiron = findPlanet('Chiron');
    // Ascendente está em planetary_positions!
    const ascendant = findPlanet('Ascendant') || findHouseByNumber(1);

    console.log('[astro-chart] Sol extraído:', JSON.stringify(sun));
    console.log('[astro-chart] Ascendente extraído:', JSON.stringify(ascendant));

    // Mapeamento de signo abreviado para completo
    const signMap: Record<string, string> = {
      'Ari': 'Áries', 'Tau': 'Touro', 'Gem': 'Gêmeos', 'Can': 'Câncer',
      'Leo': 'Leão', 'Vir': 'Virgem', 'Lib': 'Libra', 'Sco': 'Escorpião',
      'Sag': 'Sagitário', 'Cap': 'Capricórnio', 'Aqu': 'Aquário', 'Pis': 'Peixes'
    };
    const getFullSign = (abbr: string) => signMap[abbr] || abbr;

    // Filtrar aspectos desafiadores (Quadraturas e Oposições) para focar em padrões
    const tenseAspects = aspects
      .filter((a: any) => ['square', 'opposition'].includes(a.aspect_type?.toLowerCase()))
      .map((a: any) => ({
        p1: a.point1,
        p2: a.point2,
        type: a.aspect_type === 'square' ? 'Quadratura' : 'Oposição',
        orb: a.orb
      }))
      .slice(0, 5);

    // Emojis para cada planeta
    const planetEmojis: Record<string, string> = {
      'Sun': '☀️', 'Moon': '🌙', 'Mercury': '☿️', 'Venus': '♀️', 'Mars': '♂️',
      'Jupiter': '♃', 'Saturn': '♄', 'Uranus': '♅', 'Neptune': '♆', 'Pluto': '♇',
      'Chiron': '⚷', 'Ascendant': '⬆️'
    };

    // Montar dados de todos os planetas para UI rica
    const allPlanets = {
      sun: { sign: getFullSign(sun?.sign), emoji: planetEmojis['Sun'], house: sun?.house },
      moon: { sign: getFullSign(moon?.sign), emoji: planetEmojis['Moon'], house: moon?.house },
      ascendant: { sign: getFullSign(ascendant?.sign), emoji: planetEmojis['Ascendant'] },
      mercury: { sign: getFullSign(mercury?.sign), emoji: planetEmojis['Mercury'], house: mercury?.house },
      venus: { sign: getFullSign(venus?.sign), emoji: planetEmojis['Venus'], house: venus?.house },
      mars: { sign: getFullSign(mars?.sign), emoji: planetEmojis['Mars'], house: mars?.house },
      jupiter: { sign: getFullSign(jupiter?.sign), emoji: planetEmojis['Jupiter'], house: jupiter?.house },
      saturn: { sign: getFullSign(saturn?.sign), emoji: planetEmojis['Saturn'], house: saturn?.house },
      uranus: { sign: getFullSign(uranus?.sign), emoji: planetEmojis['Uranus'], house: uranus?.house },
      neptune: { sign: getFullSign(neptune?.sign), emoji: planetEmojis['Neptune'], house: neptune?.house },
      pluto: { sign: getFullSign(pluto?.sign), emoji: planetEmojis['Pluto'], house: pluto?.house },
      chiron: { sign: getFullSign(chiron?.sign), emoji: planetEmojis['Chiron'], house: chiron?.house }
    };

    const processedData = {
      user_id: userId,
      birth_date: profile.birth_date,
      birth_time: profile.birth_time,
      birth_city: profile.birth_city,
      sun_sign: getFullSign(sun?.sign) || null,
      moon_sign: getFullSign(moon?.sign) || null,
      rising_sign: getFullSign(ascendant?.sign) || null,
      chiron_sign: getFullSign(chiron?.sign) || null,
      saturn_sign: getFullSign(saturn?.sign) || null,
      aspects_summary: tenseAspects,
      astro_chart: { ...astroData, all_planets: allPlanets },
      is_configured: true,
      last_synced_at: new Date().toISOString()
    };

    // ============================================
    // 3.1 TRÂNSITOS (HORÓSCOPO): Buscar dados do dia atual
    // ============================================
    try {
      console.log('[astro-chart] Calculando trânsitos do dia...');
      const now = new Date();
      const transitResponse = await fetch('https://best-astrology-api-natal-charts-transits-synastry.p.rapidapi.com/api/v3/charts/transit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-rapidapi-host': 'best-astrology-api-natal-charts-transits-synastry.p.rapidapi.com',
          'x-rapidapi-key': rapidApiKey
        },
        body: JSON.stringify({
          subject: {
            name: profile.full_name || 'Usuário',
            birth_data: birthData
          },
          transits_data: {
            year: now.getFullYear(),
            month: now.getMonth() + 1,
            day: now.getDate(),
            hour: now.getHours(),
            minute: now.getMinutes(),
            city: profile.birth_city,
            country_code: 'BR' // Simplificado, ideal seria extrair do Nominatim
          }
        })
      });

      if (transitResponse.ok) {
        const transitData = await transitResponse.json();
        const transitAspects = transitData.aspects?.filter((a: any) =>
          ['conjunction', 'square', 'opposition'].includes(a.aspect_type?.toLowerCase())
        ).slice(0, 5) || [];

        // Adicionar ao objeto para salvar
        (processedData as any).transits_data = transitData;
        (processedData as any).last_transit_sync = new Date().toISOString();

        console.log('[astro-chart] Trânsitos calculados com sucesso.');
      } else {
        console.warn('[astro-chart] Erro ao buscar trânsitos:', await transitResponse.text());
      }
    } catch (transitError) {
      console.error('[astro-chart] Erro catch trânsitos:', transitError);
      // Não falha a função inteira se falhar o trânsito
    }

    // 4. Salvar no banco
    const { error: upsertError } = await supabase
      .from('user_astro_data')
      .upsert(processedData, { onConflict: 'user_id' });

    if (upsertError) {
      throw upsertError;
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        sun_sign: processedData.sun_sign,
        moon_sign: processedData.moon_sign,
        rising_sign: processedData.rising_sign,
        chiron_sign: processedData.chiron_sign,
        saturn_sign: processedData.saturn_sign,
        aspects_summary: processedData.aspects_summary,
        astro_chart: processedData.astro_chart
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[astro-chart] Erro:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
