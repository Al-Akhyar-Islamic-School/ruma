package sch.alakhyar.ruma;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "RumaRecorder")
public class RumaRecorderPlugin extends Plugin {
    @PluginMethod
    public void mulai(PluginCall call) {
        call.resolve();
    }

    @PluginMethod
    public void berhenti(PluginCall call) {
        call.resolve();
    }
}
