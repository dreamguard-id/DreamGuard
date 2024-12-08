package com.android.dreamguard.ui.prediction

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import com.capstone.dreamguard.R
import com.android.dreamguard.data.local.datastore.PredictionDataStore
import com.capstone.dreamguard.databinding.ActivityPrediction4Binding

class ActivityPrediction4 : AppCompatActivity() {

    private lateinit var binding: ActivityPrediction4Binding
    private var sleepQuality: Int = 5 // Default sleep quality value

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityPrediction4Binding.inflate(layoutInflater)
        setContentView(binding.root)

        setupToolbar()
        setupListeners()
        updateQualityDisplay()
    }

    private fun setupToolbar() {
        binding.toolbar.setNavigationOnClickListener {
            onBackPressedDispatcher.onBackPressed()
        }
    }

    private fun setupListeners() {
        binding.iconMinButton.setOnClickListener {
            if (sleepQuality > 1) {
                sleepQuality--
                updateQualityDisplay()
            }
        }

        binding.iconPlusButton.setOnClickListener {
            if (sleepQuality < 10) {
                sleepQuality++
                updateQualityDisplay()
            }
        }

        binding.predictButton.setOnClickListener {
            PredictionDataStore.sleepQuality = sleepQuality
            proceedToNextStep()
        }
    }

    private fun updateQualityDisplay() {
        binding.ageNumber.text = sleepQuality.toString()
    }

    private fun proceedToNextStep() {
        if (sleepQuality < 1 || sleepQuality > 10) {
            println("Invalid sleep quality value")
            return
        }
        val intent = Intent(this, ActivityPrediction5::class.java)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        startActivity(intent)
        finish()
    }
}
