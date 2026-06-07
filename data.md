Thử thách tăng độ khó cho trình render (MathJax/KaTeX) trên website của bạn đây. Dưới đây là các công thức "nặng đô" hơn, chứa ma trận, tích phân nhiều lớp, tổng chuỗi phức tạp, cấu trúc hóa học phân nhánh và các ký tự đặc biệt.

---

## 1. Toán học (Mức độ: Khó / Phức tạp)

* **Tích phân đường và Định lý Stokes:** (Kiểm tra ký hiệu tích phân mặt kín và ký tự $\nabla$)

$$\oint_{\partial \Sigma} \vec{F} \cdot d\vec{r} = \iint_{\Sigma} \left( \nabla \times \vec{F} \right) \cdot d\vec{\Sigma}$$


* **Ma trận và Định thức (Đại số tuyến tính):** (Kiểm tra khả năng căn chỉnh hàng/cột)

$$A = \begin{pmatrix} a_{11} & a_{12} & \cdots & a_{1n} \\ a_{21} & a_{22} & \cdots & a_{2n} \\ \vdots & \vdots & \ddots & \vdots \\ a_{m1} & a_{m2} & \cdots & a_{mn} \end{pmatrix}$$


* **Chuỗi Fourier và Biến đổi Fourier:** (Kiểm tra cận tích phân từ vô cùng và ký tự Hy Lạp)

$$\hat{f}(\xi) = \int_{-\infty}^{\infty} f(x) e^{-2\pi i x \xi} \, dx$$


* **Hàm Zeta Riemann:** (Kiểm tra ký hiệu tổng chuỗi vô hạn và số mũ phức tạp)

$$\zeta(s) = \sum_{n=1}^{\infty} \frac{1}{n^s} = \prod_{p \text{ nguyên tố}} \frac{1}{1 - p^{-s}}$$



---

## 2. Vật lý (Mức độ: Nâng cao)

* **Hệ phương trình Maxwell (Dạng vi phân):** (Kiểm tra đạo hàm riêng $\partial$, tích vô hướng, và toán tử Nabla)

$$\begin{cases} 
\nabla \cdot \vec{E} = \frac{\rho}{\varepsilon_0} \\ 
\nabla \cdot \vec{B} = 0 \\ 
\nabla \times \vec{E} = -\frac{\partial \vec{B}}{\partial t} \\ 
\nabla \times \vec{B} = \mu_0 \left( \vec{J} + \varepsilon_0 \frac{\partial \vec{E}}{\partial t} \right) 
\end{cases}$$


* **Phương trình Schrödinger (Cơ học lượng tử):** (Kiểm tra ký hiệu h-bar $\hbar$ và toán tử Laplace $\nabla^2$)

$$i\hbar \frac{\partial}{\partial t}\Psi(\vec{r},t) = \left[ -\frac{\hbar^2}{2m}\nabla^2 + V(\vec{r},t) \right] \Psi(\vec{r},t)$$


* **Tensor Biến dạng Einstein (Thuyết tương đối rộng):** (Kiểm tra chỉ số trên/dưới lệch nhau)

$$G_{\mu\nu} + \Lambda g_{\mu\nu} = \frac{8\pi G}{c^4} T_{\mu\nu}$$



---

## 3. Hóa học (Mức độ: Phức tạp về cấu trúc)

* **Hằng số cân bằng ($K_c$) cho phản ứng tổng quát:** (Kiểm tra tích lũy thừa tỷ lượng)
Cho phản ứng: $a\text{A} + b\text{B} \rightleftharpoons c\text{C} + d\text{D}$

$$K_c = \frac{[\text{C}]^c \cdot [\text{D}]^d}{[\text{A}]^a \cdot [\text{B}]^b}$$


* **Phương trình Nernst (Điện hóa học):** (Kiểm tra logarit tự nhiên và phân số phức hợp)

$$E = E^0 - \frac{RT}{nF} \ln \left( \frac{\prod a_{\text{sp}}^i}{\prod a_{\text{tg}}^j} \right)$$


* **Biểu diễn chuỗi phân nhánh bằng LaTeX (mhchem):** Nếu web của bạn có hỗ trợ gói `mhchem` (thường dùng chung với MathJax), hãy test chuỗi Polyme hoặc cấu trúc có liên kết đơn/đôi này:

$$\ce{CH3-CH(CH3)-C\equiv C-CH=CH2}$$


$$\ce{2H2 + O2 ->[t^\circ][\text{Xúc tác Pt}] 2H2O}$$



---

> **Lưu ý khi test:** > * Hãy co giãn màn hình (Responsive) xem các công thức dài như **Hệ phương trình Maxwell** hay **Ma trận** có bị tràn khung (overflow) hay tự động có thanh cuộn ngang (scrollbar) không.
> * Kiểm tra xem các ký tự như dấu tích phân vòng $\oint$ hay dấu căn bậc hai $\sqrt{\dots}$ kéo dài có bị đứt gãy nét không nhé!
> 
>