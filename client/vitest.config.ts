const config = {
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    exclude: [".next/**", "node_modules/**"],
  },
};

export default config;
