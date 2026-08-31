
$path = "c:\Users\Abdallah\Desktop\DWD\DWD\schedule\professor.html"
$newPath = "c:\Users\Abdallah\Desktop\DWD\DWD\schedule\professor_v2.html"

Write-Host "Reading file..."
$content = Get-Content $path -Encoding UTF8

# Define New Functions
$newSave = @"
            async function saveCurrentRoom() {
                if (!_supabase) { showToast("جاري الاتصال بقاعدة البيانات... انتظر لحظة", true); return; }

                const name = prompt("أدخل اسم للقاعة (مثلاً: القاعة 301):");
                if (!name) return;

                let lat = null, lng = null;

                const useGPS = confirm("هل تريد استخدام موقعك الحالي (GPS)؟\n\n- موافق (OK): استخدام GPS\n- إلغاء (Cancel): إدخال الإحداثيات يدوياً");

                if (useGPS) {
                    if (!navigator.geolocation) return showToast("المتصفح لا يدعم تحديد الموقع", true);
                    
                    if (window.currentPosition) {
                         lat = window.currentPosition.coords.latitude;
                         lng = window.currentPosition.coords.longitude;
                    } else {
                        try {
                            showToast("جاري تحديد الموقع...", false);
                            const pos = await new Promise((resolve, reject) =>
                                navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 })
                            );
                            lat = pos.coords.latitude;
                            lng = pos.coords.longitude;
                        } catch (err) {
                            return showToast("فشل تحديد الموقع: " + err.message, true);
                        }
                    }
                } else {
                    const inputLat = prompt("أدخل دائرة العرض (Latitude):", "30.858467");
                    const inputLng = prompt("أدخل خط الطول (Longitude):", "29.571205");
                    
                    if (!inputLat || !inputLng) return showToast("تم إلغاء العملية", true);
                    
                    lat = parseFloat(inputLat);
                    lng = parseFloat(inputLng);
                }

                if (lat === null || lng === null || isNaN(lat) || isNaN(lng)) {
                     Swal.fire('خطأ', 'فشل الحصول على إحداثيات صحيحة', 'error');
                     return;
                }

                const { data, error } = await _supabase.from('rooms').insert([{
                    name: name,
                    latitude: lat,
                    longitude: lng,
                    radius_meters: 100
                }]).select();

                if (!error) {
                    Swal.fire('تم الحفظ!', 'تم إضافة القاعة للقاعدة بنجاح', 'success');
                    loadRooms();
                    setTimeout(() => {
                         const select = document.getElementById('sess-room');
                         if(data && data[0]) select.value = data[0].id;
                    }, 500);
                } else {
                    Swal.fire('فشل الحفظ', error.message, 'error');
                }
            }
"@

$newStart = @"
            async function startSession() {
                if (!_supabase) return showToast("انتظر تحميل النظام...", true);

                const subjectInput = document.getElementById('sess-subject');
                const subjectName = subjectInput.value ? subjectInput.options[subjectInput.selectedIndex].text : "محاضرة عامة";
                const duration = parseInt(document.getElementById('sess-duration').value) || 15;
                const roomSelect = document.getElementById('sess-room');
                const selectedRoom = roomSelect.value; 

                let lat = null, lng = null, roomName = "Unknown";
                const btn = document.getElementById('btn-start-session');

                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري البدء...';

                try {
                    if (selectedRoom === 'custom') {
                        if (window.currentPosition) {
                            lat = window.currentPosition.coords.latitude;
                            lng = window.currentPosition.coords.longitude;
                            roomName = "موقع مخصص (GPS)";
                        } else {
                            const pos = await new Promise((resolve, reject) =>
                                navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 5000 })
                            );
                            lat = pos.coords.latitude;
                            lng = pos.coords.longitude;
                            roomName = "موقع مخصص (GPS)";
                        }
                    } else {
                        const option = roomSelect.options[roomSelect.selectedIndex];
                        if (!option) throw new Error("اختر قاعة صالحة");

                        const latAttr = option.getAttribute('data-lat');
                        const lngAttr = option.getAttribute('data-lng');

                        if (!latAttr) throw new Error("لاتوجد إحداثيات لهذه القاعة (بيانات ناقصة)");

                        lat = parseFloat(latAttr);
                        lng = parseFloat(lngAttr);
                        roomName = option.text;
                    }

                    if (!lat || !lng || isNaN(lat) || isNaN(lng)) throw new Error("الإحداثيات غير صالحة");

                    console.log('Starting Session:', subjectName, roomName, lat, lng);

                    const startTime = new Date();
                    const endTime = new Date(startTime.getTime() + duration * 60000);

                    const { data, error } = await _supabase.from('attendance_sessions').insert([{
                        subject_name: subjectName,
                        room_name: roomName,
                        latitude: lat,
                        longitude: lng,
                        radius_meters: 100, 
                        is_active: true,
                        start_time: startTime.toISOString(),
                        end_time: endTime.toISOString()
                    }]).select().single();

                    if (error) throw error;
                    if (!data) throw new Error("لم يتم استلام معرف الجلسة");

                    currentSessionId = data.id;

                    showToast("تم بدء الجلسة بنجاح!", false);
                    document.getElementById('session-status').classList.remove('hidden');
                    document.getElementById('btn-start-session').classList.add('hidden');
                    document.getElementById('btn-stop-session').classList.remove('hidden');

                    startTimer(duration * 60);
                    subscribeToLiveLogs(currentSessionId);

                } catch (err) {
                    console.error(err);
                    Swal.fire('خطأ', err.message || "فشل بدء الجلسة", 'error');
                } finally {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-play"></i> بدء التسجيل';
                }
            }
"@

# Slicing
# 1766 is start of saveCurrentRoom (Index 1765)
# 1906 is start of stopSession (Index 1905)
# So we take 0..1764 (Lines 1-1765)
# And 1905..end (Lines 1906-end)

Write-Host "Slicing content..."
$part1 = $content[0..1764]
$part3 = $content[1905..($content.Count - 1)]

Write-Host "Writing new file..."
$part1 | Set-Content $newPath -Encoding UTF8
$newSave | Add-Content $newPath -Encoding UTF8
$newStart | Add-Content $newPath -Encoding UTF8
$part3 | Add-Content $newPath -Encoding UTF8

Write-Host "Replacing original file..."
Remove-Item $path -Force
Move-Item $newPath $path -Force

Write-Host "Done!"
