// Shared mobile nav toggle. No storage APIs, no state beyond the DOM.
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.querySelector(".nav-toggle");
  const nav = document.querySelector("nav.primary");
  if (!btn || !nav) return;
  btn.addEventListener("click", () => nav.classList.toggle("open"));
  nav.querySelectorAll("a").forEach((a) =>
    a.addEventListener("click", () => nav.classList.remove("open"))
  );
});
