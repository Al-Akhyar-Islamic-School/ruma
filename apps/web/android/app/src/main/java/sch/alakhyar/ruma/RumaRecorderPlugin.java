package sch.alakhyar.ruma;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.core.content.ContextCompat;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "RumaRecorder")
public class RumaRecorderPlugin extends Plugin {

    @PluginMethod
    public void mulai(PluginCall call) {
        Context context = getContext();

        // Android 14: Foreground service bertipe mikrofon hanya boleh dipanggil jika RECORD_AUDIO sudah diizinkan
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            call.reject("Izin mikrofon belum diberikan.");
            return;
        }

        String judul = call.getString("judul", "Sesi Rapat");

        try {
            Intent intent = new Intent(context, RumaRecorderService.class);
            intent.setAction(RumaRecorderService.ACTION_START);
            intent.putExtra(RumaRecorderService.EXTRA_JUDUL, judul);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent);
            } else {
                context.startService(intent);
            }

            call.resolve();
        } catch (Exception e) {
            call.reject("Gagal memulai foreground service mikrofon: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void berhenti(PluginCall call) {
        Context context = getContext();
        try {
            Intent intent = new Intent(context, RumaRecorderService.class);
            intent.setAction(RumaRecorderService.ACTION_STOP);
            context.startService(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Gagal menghentikan foreground service: " + e.getMessage(), e);
        }
    }
}
