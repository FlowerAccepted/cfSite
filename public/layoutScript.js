const themeBtn = document.getElementById("theme-toggle");
if (themeBtn) {
    themeBtn.addEventListener("click", () => {
        document.body.classList.toggle("dark-theme");
    });
}
