package sch.alakhyar.ruma;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(RumaRecorderPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
