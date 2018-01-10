pipeline {
      agent { dockerfile true } 

      stages{
            stage('Configure') {
                steps{
                  script {
                        try {
                              echo 'Configure Stage!'
                        } catch (err) {
                              echo "Error detected, continuing with pipeline"
                              currentBuild.result = 'UNSTABLE'
                        }
                  }                  
                }
            }
            stage('Build') {
                steps{
                  script {
                        try {
                              echo 'Build Stage!'
                        } catch (err) {
                              echo "Error detected, continuing with pipeline"
                              currentBuild.result = 'UNSTABLE'
                        }
                  }                  
                }
            }
            stage('Test') {
                steps{
                  script {
                        try {
                              echo 'Test Stage!'
                        } catch (err) {
                              echo "Error detected, continuing with pipeline"
                              currentBuild.result = 'UNSTABLE'
                        }
                  }                  
                }
            }
            stage('Deploy') {
                steps{
                  script {
                        try {
                              echo 'Deploy Stage!'
                        } catch (err) {
                              echo "Error detected, continuing with pipeline"
                              currentBuild.result = 'UNSTABLE'
                        }
                  }                  
                }
            }
            stage('Archive') {
                steps{
                  script {
                        try {
                              echo 'Archive Stage!'
                        } catch (err) {
                              echo "Error detected, continuing with pipeline"
                              currentBuild.result = 'UNSTABLE'
                        }
                  }                  
                }
            }            
      }
      post { 
        unstable { 
            echo 'Todo send a message to slack or via email when pipeline is unstable!'
        }
        failure { 
            echo 'Todo send a message to slack or via email when pipeline fails!'
        }
        always { 
            echo 'Pipeline Completed!'
        }
    }
}
