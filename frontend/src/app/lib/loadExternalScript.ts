const loadedScripts = new Map<string, Promise<void>>();

export const loadExternalScript = (url: string): Promise<void> => {
  if (loadedScripts.has(url)) {
    return loadedScripts.get(url) as Promise<void>;
  }

  const promise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${url}"]`);
    if (existing && existing.dataset.loaded === "true") {
      resolve();
      return;
    }

    const script = existing || document.createElement("script");
    script.src = url;
    script.async = true;

    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve();
    });

    script.addEventListener("error", () => {
      loadedScripts.delete(url);
      reject(new Error(`Failed to load script: ${url}`));
    });

    if (!existing) {
      document.head.appendChild(script);
    }
  });

  loadedScripts.set(url, promise);
  return promise;
};
