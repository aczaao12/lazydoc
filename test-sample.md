## ?? Ð? BÀI: Thi?t k? h? th?ng c?p ðông nhanh IQF cho tôm

M?t nhà máy ch? bi?n xu?t kh?u c?n l?p ð?t m?t bãng chuy?n c?p ðông nhanh (IQF) d?ng th?ng ð? ðông l?nh tôm th? chân tr?ng v? b? ð?u (HLSO) t? nhi?t ð? ban ð?u là $25^\circ\text{C}$ xu?ng nhi?t ð? tâm s?n ph?m ð?t $-18^\circ\text{C}$.

* **H?nh dáng s?n ph?m:** Xem g?n ðúng con tôm có d?ng h?nh tr? vô h?n v?i ðý?ng kính trung b?nh là $D = 20\text{ mm} = 0,02\text{ m}$.
* **Thông s? v?t l? c?a tôm:**
* Hàm lý?ng ný?c trong tôm: $W = 75\%$
* Kh?i lý?ng riêng: $\rho = 1050\text{ kg/m}^3$
* Nhi?t ð? b?t ð?u ðóng bãng c?a tôm: $t_{ðb} = -1,5^\circ\text{C}$
* H? s? d?n nhi?t c?a tôm ð? ðông: $k = 1,4\text{ W/m}\cdot^\circ\text{C}$

* **Thông s? bu?ng ðông c?p ðông nhanh:**
* Nhi?t ð? không khí trong bu?ng c?p ðông: $t_f = -35^\circ\text{C}$
* H? s? truy?n nhi?t ð?i lýu t? không khí ð?n b? m?t tôm (do gió th?i m?nh): $h = 50\text{ W/m}^2\cdot^\circ\text{C}$

### YÊU C?U:

1. **Tính th?i gian l?nh ðông** (th?i gian tôm di chuy?n trên bãng chuy?n) b?ng phýõng pháp Plank (Plank'"'"'s Equation) cho h?nh tr? vô h?n.
2. **Tính d?ng nhi?t c?n tách ra t? tôm ($Q$)** ð? ch?n công su?t máy nén (b? qua t?n th?t nhi?t c?a bu?ng).

### L?i gi?i Câu 1: Tính th?i gian l?nh ðông ($\tau$)

Công th?c Plank:

$$\tau = \frac{\rho \cdot \lambda_{tôm}}{t_{ðb} - t_f} \cdot \left( \frac{1}{2} \cdot \frac{R}{h} + \frac{1}{4} \cdot \frac{R^2}{k} \right)$$

$$\lambda_{tôm} = \lambda \cdot W = 334 \cdot 0,75 = 250,5\text{ kJ/kg} = 250500\text{ J/kg}$$

$$\tau = \frac{1050 \cdot 250500}{-1,5 - (-35)} \cdot \left( \frac{1}{2} \cdot \frac{0,01}{50} + \frac{1}{4} \cdot \frac{0,01^2}{1,4} \right)$$

$$\tau = \frac{263.025.000}{33,5} \cdot \left( 0,0001 + 0,00001786 \right)$$

$$\tau = 7.851.492 \cdot 0,00011786 \approx 925,4\text{ giây}$$

### L?i gi?i Câu 2: Tính nãng su?t l?nh c?n thi?t ($Q$)

D?ng nhi?t c?n tách ra t? tôm g?m 3 giai ðo?n:

1. **$Q_1$ (Làm mát):** H? nhi?t ð? t? tôm týõi ($25^\circ\text{C}$) xu?ng nhi?t ð? ðóng bãng ($-1,5^\circ\text{C}$).
2. **$Q_2$ (Ðông ð?c):** ?n nhi?t hóa bãng ? $-1,5^\circ\text{C}$.
3. **$Q_3$ (L?nh h? ti?p):** H? nhi?t ð? tôm ð? ðông t? $-1,5^\circ\text{C}$ xu?ng $-18^\circ\text{C}$.

Nãng su?t kh?i lý?ng: $m = 500\text{ kg/gi?} = \frac{500}{3600} \approx 0,1389\text{ kg/s}$

#### Tính t?ng thành ph?n nhi?t lý?ng:

* **$Q_1 = m \cdot C_u \cdot (t_{ð?u} - t_{ðb})$**

$$Q_1 = 0,1389 \cdot 3,6 \cdot (25 - (-1,5)) = 0,1389 \cdot 3,6 \cdot 26,5 \approx 13,25\text{ kW}$$

* **$Q_2 = m \cdot \lambda_{tôm}$**

$$Q_2 = 0,1389 \cdot 250,5 \approx 34,79\text{ kW}$$

* **$Q_3 = m \cdot C_f \cdot (t_{ðb} - t_{cu?i})$**

$$Q_3 = 0,1389 \cdot 1,9 \cdot (-1,5 - (-18)) = 0,1389 \cdot 1,9 \cdot 16,5 \approx 4,35\text{ kW}$$

$$Q_{t?ng} = Q_1 + Q_2 + Q_3 = 13,25 + 34,79 + 4,35 = 52,39\text{ kW}$$

### ?? Ði?m lýu ? m? r?ng

* **Hi?n tý?ng quá l?nh (Supercooling):** Trong th?c t? c?p ðông nhanh, ð? th? s?t nhi?t ð? s? không ph?ng hoàn toàn ? ðo?n hóa bãng.
* **H? s? truy?n nhi?t $h$:** Ð? ð?t ðý?c $h = 50\text{ W/m}^2\cdot^\circ\text{C}$, v?n t?c gió trong bu?ng IQF thý?ng ph?i ðý?c th?i cý?ng b?c v?i t?c ð? r?t cao (t? $3\text{ m/s}$ ð?n $5\text{ m/s}$).
