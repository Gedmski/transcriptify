import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                background: "var(--background)",
                foreground: "var(--foreground)",
                chalk: {
                    yellow: "var(--chalk-yellow)",
                    pink: "var(--chalk-pink)",
                    blue: "var(--chalk-blue)",
                    border: "var(--chalk-border)",
                },
            },
            fontFamily: {
                sans: ["var(--font-patrick)"],
                mono: ["var(--font-jetbrains)"],
            },
        },
    },
    plugins: [],
};
export default config;
