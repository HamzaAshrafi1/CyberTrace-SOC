declare module "react-simple-maps" {
  import * as React from "react";

  export interface ComposableMapProps extends React.SVGProps<SVGSVGElement> {
    projection?: string | ((...args: any[]) => any);
    projectionConfig?: {
      scale?: number;
      center?: [number, number];
      rotate?: [number, number, number];
      parallels?: [number, number];
      [key: string]: any;
    };
    width?: number;
    height?: number;
  }

  export const ComposableMap: React.ComponentType<ComposableMapProps>;

  export interface GeographiesProps {
    geography?: string | Record<string, any> | string[];
    children: (data: { geographies: any[] }) => React.ReactNode;
    parseGeographies?: (geos: any) => any;
  }

  export const Geographies: React.ComponentType<GeographiesProps>;

  export interface GeographyProps extends Omit<React.SVGProps<SVGPathElement>, "style"> {
    geography?: any;
    style?: {
      default?: React.CSSProperties;
      hover?: React.CSSProperties;
      pressed?: React.CSSProperties;
    };
  }

  export const Geography: React.ComponentType<GeographyProps>;

  export interface MarkerProps extends React.SVGProps<SVGGElement> {
    coordinates: [number, number];
  }

  export const Marker: React.ComponentType<MarkerProps>;

  export interface LineProps extends Omit<React.SVGProps<SVGLineElement>, "style"> {
    from?: [number, number];
    to?: [number, number];
    coordinates?: [number, number][];
    stroke?: string;
    strokeWidth?: number;
  }

  export const Line: React.ComponentType<LineProps>;
}
