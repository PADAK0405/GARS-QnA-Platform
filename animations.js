document.addEventListener("DOMContentLoaded", () => {
    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("is-visible");
                    observer.unobserve(entry.target);
                }
            });
        },
        {
            threshold: 0.1, // 요소가 10% 보일 때 애니메이션 시작
        }
    );

    // .fade-in-up 클래스를 가진 모든 요소를 관찰
    const targets = document.querySelectorAll(".fade-in-up");
    targets.forEach((target) => observer.observe(target));
});