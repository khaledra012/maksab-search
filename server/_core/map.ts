import { ENV } from "./env";

type MapsConfig = {
  apiKey: string;
};

interface RequestOptions {
  method?: "GET" | "POST";
  body?: Record<string, unknown>;
  raw?: boolean;
}

function getMapsConfig(): MapsConfig {
  const apiKey = ENV.googleMapsApiKey;

  if (!apiKey) {
    throw new Error(
      "Google Maps API key missing: set GOOGLE_MAPS_API_KEY"
    );
  }

  return { apiKey };
}

export async function makeRequest<T = unknown>(
  endpoint: string,
  params: Record<string, unknown> = {},
  options: RequestOptions = {}
): Promise<T | Buffer> {
  const { apiKey } = getMapsConfig();
  const normalizedEndpoint = endpoint.startsWith("/")
    ? endpoint
    : `/${endpoint}`;
  const url = new URL(`https://maps.googleapis.com${normalizedEndpoint}`);

  url.searchParams.set("key", apiKey);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, String(value));
    }
  });

  const response = await fetch(url.toString(), {
    method: options.method || "GET",
    headers: options.body
      ? {
          "Content-Type": "application/json",
        }
      : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
    redirect: "follow",
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `Google Maps API request failed (${response.status} ${response.statusText})${
        errorText ? `: ${errorText}` : ""
      }`
    );
  }

  if (options.raw) {
    return Buffer.from(await response.arrayBuffer());
  }

  return (await response.json()) as T;
}

export type TravelMode = "driving" | "walking" | "bicycling" | "transit";
export type MapType = "roadmap" | "satellite" | "terrain" | "hybrid";
export type SpeedUnit = "KPH" | "MPH";

export type LatLng = {
  lat: number;
  lng: number;
};

export type DirectionsResult = {
  routes: Array<{
    legs: Array<{
      distance: { text: string; value: number };
      duration: { text: string; value: number };
      start_address: string;
      end_address: string;
      start_location: LatLng;
      end_location: LatLng;
      steps: Array<{
        distance: { text: string; value: number };
        duration: { text: string; value: number };
        html_instructions: string;
        travel_mode: string;
        start_location: LatLng;
        end_location: LatLng;
      }>;
    }>;
    overview_polyline: { points: string };
    summary: string;
    warnings: string[];
    waypoint_order: number[];
  }>;
  status: string;
};

export type DistanceMatrixResult = {
  rows: Array<{
    elements: Array<{
      distance: { text: string; value: number };
      duration: { text: string; value: number };
      status: string;
    }>;
  }>;
  origin_addresses: string[];
  destination_addresses: string[];
  status: string;
};

export type GeocodingResult = {
  results: Array<{
    address_components: Array<{
      long_name: string;
      short_name: string;
      types: string[];
    }>;
    formatted_address: string;
    geometry: {
      location: LatLng;
      location_type: string;
      viewport: {
        northeast: LatLng;
        southwest: LatLng;
      };
    };
    place_id: string;
    types: string[];
  }>;
  status: string;
};

export type PlacesSearchResult = {
  results: Array<{
    place_id: string;
    name: string;
    formatted_address: string;
    geometry: {
      location: LatLng;
    };
    rating?: number;
    user_ratings_total?: number;
    business_status?: string;
    types: string[];
  }>;
  status: string;
};

export type PlaceDetailsResult = {
  result: {
    place_id: string;
    name: string;
    formatted_address: string;
    formatted_phone_number?: string;
    international_phone_number?: string;
    website?: string;
    rating?: number;
    user_ratings_total?: number;
    reviews?: Array<{
      author_name: string;
      rating: number;
      text: string;
      time: number;
    }>;
    opening_hours?: {
      open_now: boolean;
      weekday_text: string[];
    };
    geometry: {
      location: LatLng;
    };
  };
  status: string;
};

export type ElevationResult = {
  results: Array<{
    elevation: number;
    location: LatLng;
    resolution: number;
  }>;
  status: string;
};

export type TimeZoneResult = {
  dstOffset: number;
  rawOffset: number;
  status: string;
  timeZoneId: string;
  timeZoneName: string;
};

export type RoadsResult = {
  snappedPoints: Array<{
    location: LatLng;
    originalIndex?: number;
    placeId: string;
  }>;
};
