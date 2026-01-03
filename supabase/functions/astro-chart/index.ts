import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================
// MAPEAMENTOS ASTROLÓGICOS
// ============================================

const signMap: Record<string, string> = {
  'Ari': 'Áries', 'Tau': 'Touro', 'Gem': 'Gêmeos', 'Can': 'Câncer',
  'Leo': 'Leão', 'Vir': 'Virgem', 'Lib': 'Libra', 'Sco': 'Escorpião',
  'Sag': 'Sagitário', 'Cap': 'Capricórnio', 'Aqu': 'Aquário', 'Pis': 'Peixes',
  // Nomes completos em inglês também (sem duplicatas)
  'Aries': 'Áries', 'Taurus': 'Touro', 'Gemini': 'Gêmeos', 'Cancer': 'Câncer',
  'Virgo': 'Virgem', 'Scorpio': 'Escorpião',
  'Sagittarius': 'Sagitário', 'Capricorn': 'Capricórnio', 'Aquarius': 'Aquário', 'Pisces': 'Peixes'
};

const elementMap: Record<string, string> = {
  'Áries': 'Fogo', 'Leão': 'Fogo', 'Sagitário': 'Fogo',
  'Touro': 'Terra', 'Virgem': 'Terra', 'Capricórnio': 'Terra',
  'Gêmeos': 'Ar', 'Libra': 'Ar', 'Aquário': 'Ar',
  'Câncer': 'Água', 'Escorpião': 'Água', 'Peixes': 'Água'
};

const qualityMap: Record<string, string> = {
  'Áries': 'Cardinal', 'Câncer': 'Cardinal', 'Libra': 'Cardinal', 'Capricórnio': 'Cardinal',
  'Touro': 'Fixo', 'Leão': 'Fixo', 'Escorpião': 'Fixo', 'Aquário': 'Fixo',
  'Gêmeos': 'Mutável', 'Virgem': 'Mutável', 'Sagitário': 'Mutável', 'Peixes': 'Mutável'
};

const polarityMap: Record<string, string> = {
  'Áries': 'Yang', 'Gêmeos': 'Yang', 'Leão': 'Yang', 'Libra': 'Yang', 'Sagitário': 'Yang', 'Aquário': 'Yang',
  'Touro': 'Yin', 'Câncer': 'Yin', 'Virgem': 'Yin', 'Escorpião': 'Yin', 'Capricórnio': 'Yin', 'Peixes': 'Yin'
};

// Dignidades planetárias (domicílio, exaltação, exílio/detrimento, queda)
const dignities: Record<string, { domicile: string[], exaltation: string | null, detriment: string[], fall: string | null }> = {
  'Sun': { domicile: ['Leão'], exaltation: 'Áries', detriment: ['Aquário'], fall: 'Libra' },
  'Moon': { domicile: ['Câncer'], exaltation: 'Touro', detriment: ['Capricórnio'], fall: 'Escorpião' },
  'Mercury': { domicile: ['Gêmeos', 'Virgem'], exaltation: 'Virgem', detriment: ['Sagitário', 'Peixes'], fall: 'Peixes' },
  'Venus': { domicile: ['Touro', 'Libra'], exaltation: 'Peixes', detriment: ['Escorpião', 'Áries'], fall: 'Virgem' },
  'Mars': { domicile: ['Áries', 'Escorpião'], exaltation: 'Capricórnio', detriment: ['Libra', 'Touro'], fall: 'Câncer' },
  'Jupiter': { domicile: ['Sagitário', 'Peixes'], exaltation: 'Câncer', detriment: ['Gêmeos', 'Virgem'], fall: 'Capricórnio' },
  'Saturn': { domicile: ['Capricórnio', 'Aquário'], exaltation: 'Libra', detriment: ['Câncer', 'Leão'], fall: 'Áries' },
  'Uranus': { domicile: ['Aquário'], exaltation: 'Escorpião', detriment: ['Leão'], fall: 'Touro' },
  'Neptune': { domicile: ['Peixes'], exaltation: 'Câncer', detriment: ['Virgem'], fall: 'Capricórnio' },
  'Pluto': { domicile: ['Escorpião'], exaltation: 'Leão', detriment: ['Touro'], fall: 'Aquário' }
};

const planetEmojis: Record<string, string> = {
  'Sun': '☀️', 'Moon': '🌙', 'Mercury': '☿️', 'Venus': '♀️', 'Mars': '♂️',
  'Jupiter': '♃', 'Saturn': '♄', 'Uranus': '♅', 'Neptune': '♆', 'Pluto': '♇',
  'Chiron': '⚷', 'Ascendant': '⬆️', 'Medium_Coeli': '🔝', 'MC': '🔝',
  'True_Node': '☊', 'Mean_Lilith': '⚸', 'Part_of_Fortune': '⊕'
};

const aspectTypeMap: Record<string, string> = {
  'conjunction': 'Conjunção',
  'opposition': 'Oposição',
  'trine': 'Trígono',
  'square': 'Quadratura',
  'sextile': 'Sextil',
  'quincunx': 'Quincúncio'
};

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

const getFullSign = (abbr: string | undefined): string | null => {
  if (!abbr) return null;
  return signMap[abbr] || abbr;
};

const getDignity = (planetName: string, sign: string | null): string | null => {
  if (!sign) return null;
  const d = dignities[planetName];
  if (!d) return null;

  if (d.domicile.includes(sign)) return 'Domicílio';
  if (d.exaltation === sign) return 'Exaltação';
  if (d.detriment.includes(sign)) return 'Exílio';
  if (d.fall === sign) return 'Queda';
  return null;
};

const formatPlanetPosition = (planet: any, planetName: string) => {
  if (!planet) return null;
  const sign = getFullSign(planet.sign);
  return {
    sign,
    degree: planet.degree ?? planet.position_degree ?? null,
    minute: planet.minute ?? planet.position_minute ?? null,
    fullPosition: planet.degree !== undefined
      ? `${planet.degree}°${(planet.minute ?? 0).toString().padStart(2, '0')}'`
      : null,
    house: planet.house ?? null,
    isRetrograde: planet.is_retrograde || planet.retrograde || false,
    emoji: planetEmojis[planetName] || '🔮',
    dignity: getDignity(planetName, sign)
  };
};

const calculateDistribution = (
  planets: any[],
  mapFn: (sign: string) => string | undefined,
  categories: string[]
): Record<string, number> => {
  const counts: Record<string, number> = {};
  categories.forEach(c => counts[c] = 0);

  let total = 0;
  planets.forEach(p => {
    if (p?.sign) {
      const sign = getFullSign(p.sign);
      if (sign) {
        const category = mapFn(sign);
        if (category && counts[category] !== undefined) {
          counts[category]++;
          total++;
        }
      }
    }
  });

  // Converter para percentuais
  const result: Record<string, number> = {};
  categories.forEach(c => {
    result[c] = total > 0 ? Math.round((counts[c] / total) * 100) : 0;
  });
  return result;
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

    // 1. Buscar dados de nascimento no perfil
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
    const [yearStr, monthStr, dayStr] = profile.birth_date.split('-');
    const [hour, minute] = (profile.birth_time || '12:00').split(':').map(Number);

    // ============================================
    // COORDENADAS
    // ============================================
    let coords = { lat: -15.7942, lng: -47.8825 }; // Default: Brasília
    let timezone = 'America/Sao_Paulo';

    if (profile.birth_latitude && profile.birth_longitude) {
      coords = { lat: profile.birth_latitude, lng: profile.birth_longitude };
      console.log(`[astro-chart] Usando coordenadas salvas: ${coords.lat}, ${coords.lng}`);
    } else {
      try {
        const geocodeUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(profile.birth_city)}&format=json&limit=1`;
        console.log(`[astro-chart] Buscando coordenadas para: ${profile.birth_city}`);

        const geoResponse = await fetch(geocodeUrl, {
          headers: { 'User-Agent': 'MyHealingChat/1.0 (Therapeutic App)' }
        });

        if (geoResponse.ok) {
          const geoData = await geoResponse.json();
          if (geoData && geoData.length > 0) {
            coords = { lat: parseFloat(geoData[0].lat), lng: parseFloat(geoData[0].lon) };
            console.log(`[astro-chart] Geocodificação OK: ${profile.birth_city} -> ${coords.lat}, ${coords.lng}`);
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

    const birthData = {
      year: parseInt(yearStr),
      month: parseInt(monthStr),
      day: parseInt(dayStr),
      hour: hour !== undefined && hour !== null ? hour : 12,
      minute: minute !== undefined && minute !== null ? minute : 0,
      second: 0,
      latitude: coords.lat,
      longitude: coords.lng,
      timezone: timezone
    };

    console.log(`[astro-chart] Calculando mapa para ${userId}:`, JSON.stringify(birthData));

    // ============================================
    // 2. CHAMAR RAPIDAPI - NATAL CHART
    // ============================================
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
          // LISTA COMPLETA DE PONTOS
          active_points: [
            'Sun', 'Moon', 'Mercury', 'Venus', 'Mars',
            'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto',
            'Chiron', 'Ascendant', 'Medium_Coeli',
            'True_Node', 'Mean_Lilith', 'Part_of_Fortune'
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

    // ============================================
    // 3. EXTRAIR DADOS COMPLETOS
    // ============================================
    const chartData = astroData.chart_data || {};
    const planets = chartData.planetary_positions || [];
    const houses = chartData.house_cusps || [];
    const aspects = chartData.aspects || [];

    const findPlanet = (name: string) => planets.find((p: any) => p.name === name);
    const findHouseByNumber = (num: number) => houses.find((h: any) => h.house === num);

    // Planetas principais
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
    const ascendant = findPlanet('Ascendant') || findHouseByNumber(1);
    const mc = findPlanet('Medium_Coeli') || findPlanet('MC');

    // Pontos adicionais
    const trueNode = findPlanet('True_Node') || findPlanet('North_Node');
    const lilith = findPlanet('Mean_Lilith') || findPlanet('Lilith');
    const fortune = findPlanet('Part_of_Fortune') || findPlanet('Fortuna');

    // ============================================
    // 4. MONTAR POSIÇÕES COMPLETAS DOS PLANETAS
    // ============================================
    const planetPositions: Record<string, any> = {
      sun: formatPlanetPosition(sun, 'Sun'),
      moon: formatPlanetPosition(moon, 'Moon'),
      mercury: formatPlanetPosition(mercury, 'Mercury'),
      venus: formatPlanetPosition(venus, 'Venus'),
      mars: formatPlanetPosition(mars, 'Mars'),
      jupiter: formatPlanetPosition(jupiter, 'Jupiter'),
      saturn: formatPlanetPosition(saturn, 'Saturn'),
      uranus: formatPlanetPosition(uranus, 'Uranus'),
      neptune: formatPlanetPosition(neptune, 'Neptune'),
      pluto: formatPlanetPosition(pluto, 'Pluto'),
      chiron: formatPlanetPosition(chiron, 'Chiron'),
      ascendant: formatPlanetPosition(ascendant, 'Ascendant'),
      mc: formatPlanetPosition(mc, 'Medium_Coeli'),
      northNode: formatPlanetPosition(trueNode, 'True_Node'),
      lilith: formatPlanetPosition(lilith, 'Mean_Lilith'),
      fortune: formatPlanetPosition(fortune, 'Part_of_Fortune')
    };

    // ============================================
    // 5. CÚSPIDES DAS 12 CASAS
    // ============================================
    const houseCusps: Record<string, any> = {};
    for (let i = 1; i <= 12; i++) {
      const cusp = findHouseByNumber(i);
      houseCusps[`house_${i}`] = {
        sign: getFullSign(cusp?.sign),
        degree: cusp?.degree ?? null,
        minute: cusp?.minute ?? null
      };
    }

    // ============================================
    // 6. DETECTAR PLANETAS RETRÓGRADOS
    // ============================================
    const retrogradePlanets: string[] = [];
    const mainPlanetsForRetro = [mercury, venus, mars, jupiter, saturn, uranus, neptune, pluto];
    const planetNames = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
    mainPlanetsForRetro.forEach((p, idx) => {
      if (p?.is_retrograde || p?.retrograde) {
        retrogradePlanets.push(planetNames[idx]);
      }
    });

    // ============================================
    // 7. CALCULAR DISTRIBUIÇÕES
    // ============================================
    const mainPlanetsForDist = [sun, moon, mercury, venus, mars, jupiter, saturn];

    const elementDistribution = calculateDistribution(
      mainPlanetsForDist,
      (sign) => elementMap[sign],
      ['Fogo', 'Terra', 'Ar', 'Água']
    );

    const qualityDistribution = calculateDistribution(
      mainPlanetsForDist,
      (sign) => qualityMap[sign],
      ['Cardinal', 'Fixo', 'Mutável']
    );

    const polarityDistribution = calculateDistribution(
      mainPlanetsForDist,
      (sign) => polarityMap[sign],
      ['Yang', 'Yin']
    );

    // ============================================
    // 8. DIGNIDADES PLANETÁRIAS
    // ============================================
    const planetaryDignities: Record<string, string | null> = {};
    const dignitiesList = [
      { planet: sun, name: 'Sun' },
      { planet: moon, name: 'Moon' },
      { planet: mercury, name: 'Mercury' },
      { planet: venus, name: 'Venus' },
      { planet: mars, name: 'Mars' },
      { planet: jupiter, name: 'Jupiter' },
      { planet: saturn, name: 'Saturn' }
    ];
    dignitiesList.forEach(({ planet, name }) => {
      const sign = getFullSign(planet?.sign);
      const dignity = getDignity(name, sign);
      if (dignity) {
        planetaryDignities[name.toLowerCase()] = dignity;
      }
    });

    // ============================================
    // 9. TODOS OS ASPECTOS (formatados)
    // ============================================
    const allAspects = aspects.map((a: any) => ({
      p1: a.point1,
      p2: a.point2,
      type: aspectTypeMap[a.aspect_type?.toLowerCase()] || a.aspect_type,
      typeOriginal: a.aspect_type,
      orb: a.orb,
      angle: a.angle
    }));

    // Aspectos tensos (para resumo rápido)
    const tenseAspects = allAspects
      .filter((a: any) => ['Quadratura', 'Oposição'].includes(a.type))
      .slice(0, 5);

    // ============================================
    // 10. MONTAR DADOS PARA SALVAR
    // ============================================
    const allPlanetsUI: Record<string, any> = {};
    Object.entries(planetPositions).forEach(([key, data]) => {
      if (data) {
        allPlanetsUI[key] = data;
      }
    });

    const processedData: any = {
      user_id: userId,
      birth_date: profile.birth_date,
      birth_time: profile.birth_time,
      birth_city: profile.birth_city,
      // Signos principais
      sun_sign: getFullSign(sun?.sign) || null,
      moon_sign: getFullSign(moon?.sign) || null,
      rising_sign: getFullSign(ascendant?.sign) || null,
      chiron_sign: getFullSign(chiron?.sign) || null,
      saturn_sign: getFullSign(saturn?.sign) || null,
      // Novos signos
      lilith_sign: getFullSign(lilith?.sign) || null,
      north_node_sign: getFullSign(trueNode?.sign) || null,
      fortune_sign: getFullSign(fortune?.sign) || null,
      mc_sign: getFullSign(mc?.sign) || null,
      // Dados estruturados
      planet_positions: planetPositions,
      house_cusps: houseCusps,
      element_distribution: elementDistribution,
      quality_distribution: qualityDistribution,
      polarity_distribution: polarityDistribution,
      retrograde_planets: retrogradePlanets,
      planetary_dignities: planetaryDignities,
      all_aspects: allAspects,
      aspects_summary: tenseAspects,
      // Legado para compatibilidade
      astro_chart: { ...astroData, all_planets: allPlanetsUI },
      is_configured: true,
      last_synced_at: new Date().toISOString()
    };

    // ============================================
    // 11. TRÂNSITOS DO DIA
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
            country_code: 'BR'
          }
        })
      });

      if (transitResponse.ok) {
        const transitData = await transitResponse.json();
        processedData.transits_data = transitData;
        processedData.last_transit_sync = new Date().toISOString();
        console.log('[astro-chart] Trânsitos calculados com sucesso.');
      } else {
        console.warn('[astro-chart] Erro ao buscar trânsitos:', await transitResponse.text());
      }
    } catch (transitError) {
      console.error('[astro-chart] Erro catch trânsitos:', transitError);
    }

    // ============================================
    // 12. SALVAR NO BANCO
    // ============================================
    const { error: upsertError } = await supabase
      .from('user_astro_data')
      .upsert(processedData, { onConflict: 'user_id' });

    if (upsertError) {
      throw upsertError;
    }

    console.log('[astro-chart] Mapa astral completo salvo com sucesso!');

    return new Response(JSON.stringify({
      success: true,
      data: {
        sun_sign: processedData.sun_sign,
        moon_sign: processedData.moon_sign,
        rising_sign: processedData.rising_sign,
        chiron_sign: processedData.chiron_sign,
        saturn_sign: processedData.saturn_sign,
        lilith_sign: processedData.lilith_sign,
        north_node_sign: processedData.north_node_sign,
        fortune_sign: processedData.fortune_sign,
        mc_sign: processedData.mc_sign,
        planet_positions: processedData.planet_positions,
        house_cusps: processedData.house_cusps,
        element_distribution: processedData.element_distribution,
        quality_distribution: processedData.quality_distribution,
        polarity_distribution: processedData.polarity_distribution,
        retrograde_planets: processedData.retrograde_planets,
        planetary_dignities: processedData.planetary_dignities,
        aspects_summary: processedData.aspects_summary,
        all_aspects: processedData.all_aspects,
        astro_chart: processedData.astro_chart,
        transits_data: processedData.transits_data
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
